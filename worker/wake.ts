// How the Worker deals with Render's free tier putting the backend to sleep after 15 idle minutes.
// The system admin picks the mode on the Settings page; it's kept in Workers KV (not the
// backend's database) because the cron has to read it without waking the backend.
//
//  - keepalive: the cron pings the backend every 10 minutes, so it never sleeps. No cold starts,
//    and the live-score scraper keeps running, but it uses ~720-744 of the 750 free hours a month.
//  - retry: the backend is left to sleep. A request that finds it asleep or still booting is
//    retried every RETRY_DELAY_MS, up to retryCount times, instead of failing.
//  - none: neither; the first request after a sleep may fail while the backend boots.
//  - matchwindows: keep alive only while there's a match on (or a reminder to send), from the
//    windows the backend publishes (Services/MatchWindows.cs); otherwise sleep, with requests
//    retried as in "retry". Once a day the backend is woken briefly so its scraper can find
//    newly published fixtures.

export type WakeMode = "keepalive" | "retry" | "none" | "matchwindows";

export interface WakeConfig {
  mode: WakeMode;
  retryCount: number;
}

export const WAKE_CONFIG_KEY = "backend-wake";
// Sent by the app's quick "is the server up?" check: answer at once, without the retry loop.
// Keep in step with waitForServer in src/lib/api.ts.
export const WAKE_PROBE_HEADER = "X-Wake-Probe";
// Today's behaviour until the system admin chooses otherwise.
export const DEFAULT_WAKE_CONFIG: WakeConfig = { mode: "keepalive", retryCount: 12 };
// Workers allow 50 outbound requests per incoming request on the free plan; stay well below it.
export const MAX_RETRY_COUNT = 30;
// Render takes about a minute to wake a service, so the default 12 retries waits ~60 seconds.
export const RETRY_DELAY_MS = 5_000;
// Measured wake-ups took 35-90s (12/11/2026). Never wait less than this (~120s), whatever retry count is set, or the first sign-in after a
// sleep fails. 25 attempts stay well inside the 50 subrequests a Worker request may make.
export const MIN_WAKE_RETRIES = 24;

/** The retries actually made: the configured count, but never fewer than a slow wake-up needs. */
export const effectiveRetryCount = (configured: number) => Math.max(configured, MIN_WAKE_RETRIES);

// When Render's edge refuses the cron's ping, the cron leaves the backend alone for this long
// rather than adding a ping every 10 minutes to the traffic being refused.
export const EDGE_BLOCK_KEY = "edge-blocked-until";
export const EDGE_BACKOFF_MS = 30 * 60_000;

/** Whether the cron should hold off pinging, given the stored "blocked until" time (ms, as text). */
export function inEdgeBackoff(blockedUntil: string | null, now: number): boolean {
  const until = Number(blockedUntil);
  return blockedUntil !== null && Number.isFinite(until) && until > now;
}

const MODES: readonly WakeMode[] = ["keepalive", "retry", "none", "matchwindows"];

/** Requests are retried while the backend wakes in these modes, since it's allowed to sleep. */
export const retriesRequests = (mode: WakeMode) => mode === "retry" || mode === "matchwindows";

// ── Match windows ────────────────────────────────────────────────────────────────────────────

export const WAKE_SCHEDULE_KEY = "wake-schedule";
export const WAKE_WINDOWS_PATH = "/api/public/wake-windows";
// Wake the backend at least this often even with no match on, so its scraper (which also
// discovers new fixtures) runs and the schedule here stays current.
export const SCHEDULE_MAX_AGE_MS = 24 * 60 * 60_000;
// While the backend is awake anyway (someone is using the app), refresh the schedule this often,
// so a fixture added or moved since the last check is picked up without waiting a day.
export const SCHEDULE_REFRESH_MS = 60 * 60_000;

export interface TimeWindow {
  start: number;
  end: number;
}

export interface WakeSchedule {
  fetchedAt: number;
  windows: TimeWindow[];
}

/** The windows from the backend's /api/public/wake-windows answer, or null if it isn't one. */
export function parseWakeWindows(body: unknown): TimeWindow[] | null {
  const windows = (body as { windows?: unknown } | null)?.windows;
  if (!Array.isArray(windows)) return null;
  const parsed = windows.map((w) => ({ start: Date.parse(w?.start), end: Date.parse(w?.end) }));
  return parsed.every((w) => Number.isFinite(w.start) && Number.isFinite(w.end) && w.end > w.start) ? parsed : null;
}

export const inWindow = (schedule: WakeSchedule | null, now: number) =>
  !!schedule?.windows.some((w) => w.start <= now && now < w.end);

/** The window on now, or else the next one to open. */
export const currentOrNextWindow = (schedule: WakeSchedule | null, now: number) =>
  schedule?.windows.filter((w) => w.end > now).sort((a, b) => a.start - b.start)[0] ?? null;

/**
 * Whether the cron should wake (or keep awake) the backend now: during a window, or when the
 * schedule is missing or a day old.
 */
export function shouldWakeForSchedule(schedule: WakeSchedule | null, now: number): boolean {
  if (!schedule || now - schedule.fetchedAt >= SCHEDULE_MAX_AGE_MS) return true;
  return inWindow(schedule, now);
}

/** A valid config from untrusted JSON, or null. */
export function parseWakeConfig(value: unknown): WakeConfig | null {
  if (typeof value !== "object" || value === null) return null;
  const { mode, retryCount } = value as Record<string, unknown>;
  if (!MODES.includes(mode as WakeMode)) return null;
  if (!Number.isInteger(retryCount) || (retryCount as number) < 1 || (retryCount as number) > MAX_RETRY_COUNT)
    return null;
  return { mode: mode as WakeMode, retryCount: retryCount as number };
}

/**
 * Render doesn't document what a request gets while a free service boots: browsers are shown a
 * loading page, other clients may get a 5xx. The backend itself never answers /api/* with HTML,
 * and its own 5xx answers (the health checks' 503) are JSON, so anything else means "not up yet".
 * A 504 may mean the request did reach the app, so only requests safe to repeat are retried on it.
 */
export function looksAsleep(res: Response, idempotent: boolean): boolean {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) return true;
  if (contentType.includes("application/json")) return false;
  if (res.status === 502 || res.status === 503) return true;
  return res.status === 504 && idempotent;
}

/**
 * Render's edge (Cloudflare) is refusing requests instead of passing them on: a bot check
 * (`cf-mitigated: challenge`) or a bare 429. The backend never sees these requests. On 13/11/2026
 * the whole hostname was challenged for most of a day, from every IP, even with the service
 * running, so waking can't get past it, and bursts of retries are the traffic most likely to keep
 * it on. So a refused request is never retried. The backend's own 429s are JSON and pass through.
 */
export function blockedAtEdge(res: Response): boolean {
  if (res.headers.has("cf-mitigated")) return true;
  return res.status === 429 && !(res.headers.get("content-type") ?? "").includes("application/json");
}

/**
 * What the app shows when the edge refuses a request: a message it can display, not a challenge page.
 *
 * A bot check (`cf-mitigated: challenge`) is answered with `human_check` and the backend's address:
 * a person who opens that address in their own browser and ticks "I'm human" gets a request
 * through, which wakes the backend, after which the Worker's requests pass again (seen 13/11/2026).
 * The app offers that as one tap (src/hooks/useWakeServer.ts). A bare 429 is a rate limit, which
 * no checkbox clears, so it stays `backend_busy`.
 */
export function edgeBlockedResponse(blocked: Response, backendUrl: string): Response {
  const headers: Record<string, string> = {};
  const retryAfter = blocked.headers.get("retry-after");
  if (retryAfter) headers["Retry-After"] = retryAfter;
  if (blocked.headers.get("cf-mitigated") === "challenge") {
    return Response.json(
      {
        message: "The server is asleep and its host wants a quick check that you're human before starting it.",
        code: "human_check",
        wakeUrl: new URL("/", backendUrl).toString(),
      },
      { status: 429, headers },
    );
  }
  return Response.json(
    { message: "The server is busy right now. Please try again in a few minutes.", code: "backend_busy" },
    { status: 429, headers },
  );
}

export const isIdempotent = (method: string) => ["GET", "HEAD", "OPTIONS", "PUT", "DELETE"].includes(method);

export interface RetryDeps {
  fetch: (request: Request) => Promise<Response>;
  sleep: (ms: number) => Promise<void>;
}

const defaultDeps: RetryDeps = {
  fetch: (request) => fetch(request),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/**
 * Sends the request built by makeRequest (called once per attempt, since a body can only be sent
 * once), retrying while the backend looks asleep. Gives up with a 503 the app can show.
 */
export async function fetchWithWakeRetry(
  makeRequest: () => Request,
  retryCount: number,
  deps: RetryDeps = defaultDeps,
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const request = makeRequest();
    const idempotent = isIdempotent(request.method);
    try {
      const res = await deps.fetch(request);
      if (blockedAtEdge(res)) {
        // Retrying can't get past the edge and only adds to the traffic it is refusing. Stop and
        // say so; the app checks again on its own, gently (waitForServer in src/lib/api.ts).
        console.warn(`wake-retry: ${new URL(request.url).pathname} refused at Render's edge (${res.status}), not retrying`);
        await res.body?.cancel();
        return edgeBlockedResponse(res, request.url);
      }
      if (!looksAsleep(res, idempotent)) {
        if (attempt > 0) console.log(`wake-retry: ${new URL(request.url).pathname} answered after ${attempt} retries`);
        return res;
      }
      await res.body?.cancel();
    } catch (err) {
      // No connection at all: the request never reached the app, so it's safe to send again.
      console.log(`wake-retry: attempt ${attempt + 1} failed`, err);
    }
    if (attempt >= retryCount) break;
    await deps.sleep(RETRY_DELAY_MS);
  }
  console.error(`wake-retry: backend still not up after ${retryCount} retries`);
  return Response.json(
    {
      message: "The server is starting up and didn't answer in time. Please try again in a minute.",
      code: "backend_waking",
    },
    { status: 503 },
  );
}
