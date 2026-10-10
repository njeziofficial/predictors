import { describe, it, expect, vi } from "vitest";
import {
  currentOrNextWindow,
  fetchWithWakeRetry,
  looksAsleep,
  parseWakeConfig,
  parseWakeWindows,
  RETRY_DELAY_MS,
  SCHEDULE_MAX_AGE_MS,
  shouldWakeForSchedule,
  type WakeSchedule,
} from "../../worker/wake";

describe("match windows", () => {
  const at = (iso: string) => Date.parse(iso);
  // Saturday: matches from 13:00 to ~23:00.
  const schedule: WakeSchedule = {
    fetchedAt: at("2026-10-10T08:00:00Z"),
    windows: [
      { start: at("2026-10-10T12:30:00Z"), end: at("2026-10-10T23:00:00Z") },
      { start: at("2026-10-11T12:30:00Z"), end: at("2026-10-11T22:00:00Z") },
    ],
  };

  it("wakes the backend during a window and lets it sleep outside one", () => {
    expect(shouldWakeForSchedule(schedule, at("2026-10-10T15:00:00Z"))).toBe(true);
    expect(shouldWakeForSchedule(schedule, at("2026-10-10T10:00:00Z"))).toBe(false);
    expect(shouldWakeForSchedule(schedule, at("2026-10-10T23:00:00Z"))).toBe(false);
  });

  it("wakes the backend when the schedule is missing or a day old", () => {
    expect(shouldWakeForSchedule(null, at("2026-10-10T10:00:00Z"))).toBe(true);
    expect(shouldWakeForSchedule(schedule, schedule.fetchedAt + SCHEDULE_MAX_AGE_MS)).toBe(true);
  });

  it("reports the window on now, or the next one", () => {
    expect(currentOrNextWindow(schedule, at("2026-10-10T15:00:00Z"))?.start).toBe(at("2026-10-10T12:30:00Z"));
    expect(currentOrNextWindow(schedule, at("2026-10-11T01:00:00Z"))?.start).toBe(at("2026-10-11T12:30:00Z"));
    expect(currentOrNextWindow(schedule, at("2026-10-12T01:00:00Z"))).toBeNull();
  });

  it("reads the backend's windows and rejects anything malformed", () => {
    expect(
      parseWakeWindows({ windows: [{ start: "2026-10-10T12:30:00Z", end: "2026-10-10T23:00:00Z" }] }),
    ).toEqual([{ start: at("2026-10-10T12:30:00Z"), end: at("2026-10-10T23:00:00Z") }]);
    expect(parseWakeWindows({ windows: [] })).toEqual([]);
    expect(parseWakeWindows({ windows: [{ start: "soon", end: "later" }] })).toBeNull();
    expect(parseWakeWindows({})).toBeNull();
  });

  it("accepts match windows as a mode", () => {
    expect(parseWakeConfig({ mode: "matchwindows", retryCount: 12 })).toEqual({ mode: "matchwindows", retryCount: 12 });
  });
});

const json = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const loadingPage = () => new Response("<html>Waking up</html>", { status: 200, headers: { "content-type": "text/html" } });
const gateway = (status: number) => new Response("Bad gateway", { status, headers: { "content-type": "text/plain" } });

const deps = (responses: (Response | Error)[]) => {
  const fetch = vi.fn(async () => {
    const next = responses.shift()!;
    if (next instanceof Error) throw next;
    return next;
  });
  const sleep = vi.fn(async () => {});
  return { fetch, sleep };
};

const get = () => new Request("https://backend.test/api/weeks");
const post = () => new Request("https://backend.test/api/predictions", { method: "POST", body: "{}" });

describe("looksAsleep", () => {
  it("treats Render's loading page and bare gateway errors as asleep", () => {
    expect(looksAsleep(loadingPage(), false)).toBe(true);
    expect(looksAsleep(gateway(502), false)).toBe(true);
    expect(looksAsleep(gateway(503), false)).toBe(true);
  });

  it("trusts the backend's own JSON answers, including its 503s", () => {
    expect(looksAsleep(json(200), true)).toBe(false);
    expect(looksAsleep(json(503, { status: "unhealthy" }), true)).toBe(false);
    expect(looksAsleep(json(400), false)).toBe(false);
  });

  it("only retries a gateway timeout for requests that are safe to repeat", () => {
    expect(looksAsleep(gateway(504), true)).toBe(true);
    expect(looksAsleep(gateway(504), false)).toBe(false);
  });
});

describe("fetchWithWakeRetry", () => {
  it("retries until the backend is up, then returns its answer", async () => {
    const d = deps([loadingPage(), new Error("connection refused"), gateway(502), json(200, { ok: true })]);
    const res = await fetchWithWakeRetry(get, 12, d);
    expect(await res.json()).toEqual({ ok: true });
    expect(d.fetch).toHaveBeenCalledTimes(4);
    expect(d.sleep).toHaveBeenCalledTimes(3);
    expect(d.sleep).toHaveBeenCalledWith(RETRY_DELAY_MS);
  });

  it("sends a fresh request (with its body) on every attempt", async () => {
    const d = deps([gateway(503), json(200)]);
    const make = vi.fn(post);
    await fetchWithWakeRetry(make, 3, d);
    expect(make).toHaveBeenCalledTimes(2);
  });

  it("gives up after the retry count with a message the app can show", async () => {
    const d = deps([gateway(503), gateway(503), gateway(503)]);
    const res = await fetchWithWakeRetry(get, 2, d);
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ code: "backend_waking" });
    expect(d.fetch).toHaveBeenCalledTimes(3); // the first try plus 2 retries
  });

  it("doesn't retry a real error from the backend", async () => {
    const d = deps([json(400, { message: "Invalid outcome" })]);
    const res = await fetchWithWakeRetry(post, 5, d);
    expect(res.status).toBe(400);
    expect(d.sleep).not.toHaveBeenCalled();
  });
});

describe("parseWakeConfig", () => {
  it("accepts the three modes with a retry count in range", () => {
    expect(parseWakeConfig({ mode: "retry", retryCount: 12 })).toEqual({ mode: "retry", retryCount: 12 });
    expect(parseWakeConfig({ mode: "none", retryCount: 1 })).toEqual({ mode: "none", retryCount: 1 });
  });

  it("rejects anything else", () => {
    expect(parseWakeConfig({ mode: "sometimes", retryCount: 5 })).toBeNull();
    expect(parseWakeConfig({ mode: "retry", retryCount: 0 })).toBeNull();
    expect(parseWakeConfig({ mode: "retry", retryCount: 31 })).toBeNull();
    expect(parseWakeConfig({ mode: "retry", retryCount: 2.5 })).toBeNull();
    expect(parseWakeConfig(null)).toBeNull();
  });
});
