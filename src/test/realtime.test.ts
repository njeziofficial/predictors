import { afterEach, describe, expect, it, vi } from "vitest";
import { askTransport, detectTransport, resetDetectedTransport, type RealtimeTransport } from "@/lib/realtime";

const answer = (status: number, body?: unknown, type = "application/json") =>
  vi.fn(async () => new Response(body === undefined ? null : typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "Content-Type": type } }));

describe("which live connection the backend speaks", () => {
  afterEach(() => {
    resetDetectedTransport();
    vi.useRealTimers();
  });

  it("is Socket.IO when the NestJS backend says so", async () => {
    expect(await askTransport(answer(200, { transport: "socketio", path: "/api/hubs/socket" }))).toBe("socketio");
  });

  it("is SignalR when the backend has no such route (the .NET backend)", async () => {
    expect(await askTransport(answer(404))).toBe("signalr");
  });

  it.each([
    ["asleep or waking", answer(503, { message: "waking" })],
    ["a proxy's own page", answer(200, "<html>Just a moment</html>", "text/html")],
    ["offline", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch")))],
  ])("can't tell while the backend is %s", async (_, fetchImpl) => {
    expect(await askTransport(fetchImpl as unknown as typeof fetch)).toBeNull();
  });

  it("keeps asking until a definite answer, then remembers it for the page", async () => {
    vi.useFakeTimers();
    // Asleep, waking, then the .NET backend's 404.
    const answers: (RealtimeTransport | null)[] = [null, null, "signalr"];
    const ask = vi.fn(async () => (answers.length > 0 ? answers.shift()! : "socketio"));

    const detected = detectTransport({ stopped: false }, ask);
    await vi.runAllTimersAsync();
    expect(await detected).toBe("signalr");
    expect(ask).toHaveBeenCalledTimes(3);

    // A second connection on the same page doesn't ask again.
    expect(await detectTransport({ stopped: false }, ask)).toBe("signalr");
    expect(ask).toHaveBeenCalledTimes(3);
  });

  it("gives up when the connection is stopped, and asks afresh next time", async () => {
    vi.useFakeTimers();
    const state = { stopped: false };
    const detected = detectTransport(state, async () => null);
    state.stopped = true;
    const outcome = detected.catch((err: Error) => err.message);
    await vi.runAllTimersAsync();
    expect(await outcome).toMatch(/Stopped/);

    expect(await detectTransport({ stopped: false }, async () => "socketio")).toBe("socketio");
  });
});
