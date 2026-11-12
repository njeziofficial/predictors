import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitForServer } from "@/lib/api";

const ok = () => new Response(JSON.stringify({ open: true }), { status: 200, headers: { "content-type": "application/json" } });
const busy = () => new Response(JSON.stringify({ code: "backend_busy" }), { status: 429 });

describe("waitForServer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("goes straight on when the server is awake, without saying it's waking", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok());
    vi.stubGlobal("fetch", fetchMock);
    const onWaking = vi.fn();
    await expect(waitForServer(onWaking)).resolves.toBe(true);
    expect(onWaking).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({ "X-Wake-Probe": "1" });
  });

  it("keeps checking through Render's refusals and a dropped connection until the server is up", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(busy())
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(ok());
    vi.stubGlobal("fetch", fetchMock);
    const onWaking = vi.fn();
    const result = waitForServer(onWaking);
    await vi.advanceTimersByTimeAsync(25_000);
    await expect(result).resolves.toBe(true);
    expect(onWaking).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("gives up after about five minutes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => busy()));
    const result = waitForServer(() => {});
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    await expect(result).resolves.toBe(false);
  });
});
