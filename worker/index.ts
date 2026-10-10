import {
  DEFAULT_WAKE_CONFIG,
  MAX_RETRY_COUNT,
  RETRY_DELAY_MS,
  SCHEDULE_REFRESH_MS,
  WAKE_CONFIG_KEY,
  WAKE_SCHEDULE_KEY,
  WAKE_WINDOWS_PATH,
  currentOrNextWindow,
  fetchWithWakeRetry,
  inWindow,
  parseWakeConfig,
  parseWakeWindows,
  retriesRequests,
  shouldWakeForSchedule,
  type WakeConfig,
  type WakeSchedule,
} from "./wake";

// Mirrors nginx.conf: serve the SPA from static assets and forward /api/* to the backend,
// so the browser only ever talks to one origin (no CORS, VITE_API_URL stays "").
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  BACKEND_URL: string;
  EDGE_CONFIG?: KVNamespace;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

// The Worker's own endpoint for the wake settings; never forwarded to the backend.
const WAKE_CONFIG_PATH = "/api/edge/wake-config";

// KV is read on every proxied request, so each Worker instance keeps its copy for a short while.
// A change therefore reaches every instance within about a minute (KV itself also takes up to one).
const KV_CACHE_MS = 30_000;
let cachedConfig: { value: WakeConfig; at: number } | null = null;
let cachedSchedule: { value: WakeSchedule | null; at: number } | null = null;

async function readWakeConfig(env: Env): Promise<WakeConfig> {
  if (cachedConfig && Date.now() - cachedConfig.at < KV_CACHE_MS) return cachedConfig.value;
  let value = DEFAULT_WAKE_CONFIG;
  try {
    const raw = await env.EDGE_CONFIG?.get(WAKE_CONFIG_KEY);
    if (raw) value = parseWakeConfig(JSON.parse(raw)) ?? DEFAULT_WAKE_CONFIG;
  } catch (err) {
    console.error("wake-config: read failed, using the default", err);
  }
  cachedConfig = { value, at: Date.now() };
  return value;
}

async function readSchedule(env: Env): Promise<WakeSchedule | null> {
  if (cachedSchedule && Date.now() - cachedSchedule.at < KV_CACHE_MS) return cachedSchedule.value;
  let value: WakeSchedule | null = null;
  try {
    const raw = await env.EDGE_CONFIG?.get(WAKE_SCHEDULE_KEY);
    if (raw) value = JSON.parse(raw) as WakeSchedule;
  } catch (err) {
    console.error("wake-schedule: read failed", err);
  }
  cachedSchedule = { value, at: Date.now() };
  return value;
}

// Asks the backend when it next needs to be awake. Waking it is the point when the cron calls
// this, so it waits out a cold start.
async function refreshSchedule(env: Env): Promise<void> {
  try {
    const res = await fetch(new URL(WAKE_WINDOWS_PATH, env.BACKEND_URL), {
      headers: { "ngrok-skip-browser-warning": "true" },
      signal: AbortSignal.timeout(90_000), // a cold start can take up to a minute
    });
    const windows = res.ok ? parseWakeWindows(await res.json().catch(() => null)) : null;
    if (!windows) {
      console.error(`wake-schedule: backend answered ${res.status} without windows`);
      return;
    }
    const schedule: WakeSchedule = { fetchedAt: Date.now(), windows };
    await env.EDGE_CONFIG?.put(WAKE_SCHEDULE_KEY, JSON.stringify(schedule));
    cachedSchedule = { value: schedule, at: Date.now() };
    console.log(`wake-schedule: ${windows.length} windows, in one now: ${inWindow(schedule, Date.now())}`);
  } catch (err) {
    console.error("wake-schedule: refresh failed", err);
  }
}

// The cron in wrangler.jsonc calls this every 10 minutes. Render spins the backend down after
// 15 idle minutes, which also stops its scraper and reminder jobs.
async function onCron(env: Env): Promise<void> {
  if (!env.BACKEND_URL) return;
  const config = await readWakeConfig(env);

  if (config.mode === "matchwindows") {
    // The refresh is the ping: it wakes the backend, or keeps it awake.
    if (shouldWakeForSchedule(await readSchedule(env), Date.now())) await refreshSchedule(env);
    else console.log("keep-alive: no match on, letting the backend sleep");
    return;
  }

  if (config.mode !== "keepalive") {
    console.log(`keep-alive: skipped (mode is ${config.mode})`);
    return;
  }
  try {
    // "/" only redirects to /swagger: no database work. Don't follow the redirect (404 in production).
    const res = await fetch(new URL("/", env.BACKEND_URL), {
      redirect: "manual",
      signal: AbortSignal.timeout(90_000), // a cold start can take up to a minute
    });
    console.log(`keep-alive: backend answered ${res.status}`);
  } catch (err) {
    console.error("keep-alive: backend ping failed", err);
  }
}

async function proxyToBackend(request: Request, env: Env, url: URL, ctx: ExecutionContext): Promise<Response> {
  const target = new URL(url.pathname + url.search, env.BACKEND_URL);
  const headers = new Headers(request.headers);
  headers.set("X-Forwarded-Host", url.host);
  headers.set("X-Forwarded-Proto", url.protocol.replace(":", ""));
  // Backend is exposed through ngrok's free tier, which otherwise answers browser-like
  // requests with an HTML interstitial; harmless when BACKEND_URL isn't ngrok.
  headers.set("ngrok-skip-browser-warning", "true");
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) {
    headers.set("X-Real-IP", ip);
    headers.set("X-Forwarded-For", ip);
  }

  const config = await readWakeConfig(env);
  // WebSocket upgrades (the chat hub) can't be replayed; SignalR reconnects on its own anyway.
  const isUpgrade = request.headers.get("Upgrade")?.toLowerCase() === "websocket";
  if (!retriesRequests(config.mode) || isUpgrade) {
    const proxied = new Request(target, request);
    headers.forEach((value, key) => proxied.headers.set(key, value));
    return fetch(proxied);
  }

  // A body can only be sent once, so keep a copy for each attempt.
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : undefined;
  const res = await fetchWithWakeRetry(
    () => new Request(target, { method: request.method, headers, body, redirect: request.redirect }),
    config.retryCount,
  );

  // The backend is awake now anyway: a cheap moment to pick up fixtures added or moved.
  if (config.mode === "matchwindows" && res.ok) {
    const schedule = await readSchedule(env);
    if (!schedule || Date.now() - schedule.fetchedAt > SCHEDULE_REFRESH_MS) {
      cachedSchedule = { value: schedule && { ...schedule, fetchedAt: Date.now() }, at: Date.now() }; // one refresh at a time
      ctx.waitUntil(refreshSchedule(env));
    }
  }
  return res;
}

// The settings are the system admin's alone. The backend decides who that is, from the same
// token the app sends with every request.
async function checkSystemUser(request: Request, env: Env): Promise<Response | null> {
  const authorization = request.headers.get("Authorization");
  if (!authorization) return Response.json({ message: "Sign in first." }, { status: 401 });

  const config = await readWakeConfig(env);
  const res = await fetchWithWakeRetry(
    () =>
      new Request(new URL("/api/admin/permissions/me", env.BACKEND_URL), {
        headers: { Authorization: authorization, "ngrok-skip-browser-warning": "true" },
      }),
    retriesRequests(config.mode) ? config.retryCount : 0,
  );
  // Pass a 401 through so the app refreshes an expired session and tries again.
  if (res.status === 401) return Response.json({ message: "Session expired." }, { status: 401 });
  // Backend asleep or failing: say so, rather than claim the user isn't allowed.
  if (res.status >= 500) return res;
  const me = res.ok ? ((await res.json().catch(() => null)) as { isSystemUser?: boolean } | null) : null;
  if (me?.isSystemUser !== true)
    return Response.json({ code: "permission_denied", message: "Only the system admin can do this." }, { status: 403 });
  return null;
}

async function describe(config: WakeConfig, env: Env) {
  const schedule = await readSchedule(env);
  const window = currentOrNextWindow(schedule, Date.now());
  return {
    ...config,
    maxRetryCount: MAX_RETRY_COUNT,
    retryDelaySeconds: RETRY_DELAY_MS / 1000,
    // What "match windows" mode is working from (kept up to date in every mode).
    schedule: schedule && {
      fetchedAt: new Date(schedule.fetchedAt).toISOString(),
      inWindow: inWindow(schedule, Date.now()),
      nextWindow: window && { start: new Date(window.start).toISOString(), end: new Date(window.end).toISOString() },
    },
  };
}

async function handleWakeConfig(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (request.method !== "GET" && request.method !== "PUT")
    return Response.json({ message: "Method not allowed." }, { status: 405 });
  if (!env.EDGE_CONFIG)
    return Response.json(
      { message: "Settings storage isn't set up: add the EDGE_CONFIG KV binding to the Worker.", code: "edge_config_missing" },
      { status: 503 },
    );

  const denied = await checkSystemUser(request, env);
  if (denied) return denied;

  // The backend just answered, so it's awake: fetch its windows so the page has them to show.
  cachedSchedule = null;
  if (!(await readSchedule(env))) await refreshSchedule(env);

  if (request.method === "GET") {
    cachedConfig = null; // show what's actually stored, not this instance's copy
    return Response.json(await describe(await readWakeConfig(env), env));
  }

  const config = parseWakeConfig(await request.json().catch(() => null));
  if (!config)
    return Response.json(
      { message: `Choose a mode, with a retry count from 1 to ${MAX_RETRY_COUNT}.` },
      { status: 400 },
    );
  await env.EDGE_CONFIG.put(WAKE_CONFIG_KEY, JSON.stringify(config));
  cachedConfig = { value: config, at: Date.now() };
  console.log(`wake-config: set to ${JSON.stringify(config)}`);
  if (config.mode === "matchwindows") ctx.waitUntil(refreshSchedule(env));
  return Response.json(await describe(config, env));
}

export default {
  async scheduled(_controller: unknown, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(onCron(env));
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      if (!env.BACKEND_URL) {
        return Response.json(
          { message: "Backend not configured: set BACKEND_URL on the Cloudflare Worker.", code: "backend_not_configured" },
          { status: 503 },
        );
      }
      if (url.pathname === WAKE_CONFIG_PATH) return handleWakeConfig(request, env, ctx);
      return proxyToBackend(request, env, url, ctx);
    }

    return env.ASSETS.fetch(request);
  },
};
