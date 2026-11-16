import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

const checkServer = vi.fn();
vi.mock("@/lib/api", () => ({ checkServer: () => checkServer() }));

vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

import { toast } from "sonner";
import {
  ASK_POLL_MS,
  AWAKE_CHANNEL,
  WAIT_MAX_MS,
  WAIT_POLL_MS,
  useWakeServer,
  type WakeResult,
} from "@/hooks/useWakeServer";

const WAKE_URL = "https://backend.test/";
const down = { state: "down" };
const check = { state: "human_check", wakeUrl: WAKE_URL };
const up = { state: "up" };

// Stands in for the channel public/server-awake.html posts on.
class FakeChannel {
  onmessage: ((e: { data: unknown }) => void) | null = null;
  closed = false;
  constructor(readonly name: string) {
    channels.push(this);
  }
  close() {
    this.closed = true;
  }
}
const channels: FakeChannel[] = [];
vi.stubGlobal("BroadcastChannel", FakeChannel);

describe("useWakeServer", () => {
  let popup: { close: ReturnType<typeof vi.fn>; closed: boolean };

  beforeEach(() => {
    vi.useFakeTimers();
    checkServer.mockReset().mockResolvedValue(check);
    popup = { close: vi.fn(), closed: false };
    vi.spyOn(window, "open").mockImplementation(() => popup as unknown as Window);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const start = () => {
    const hook = renderHook(() => useWakeServer());
    let settled: WakeResult | undefined;
    act(() => {
      void hook.result.current.ask(WAKE_URL).then((r) => (settled = r));
    });
    return { hook, result: () => settled };
  };

  it("asks for the tap, opens the check's page in a small window, and closes it once the server answers", async () => {
    const { hook, result } = start();
    expect(hook.result.current.phase).toBe("ask");
    expect(hook.result.current.wakeUrl).toBe(WAKE_URL);

    act(() => hook.result.current.openCheck());
    expect(window.open).toHaveBeenCalledWith(WAKE_URL, "op-server-check", expect.stringContaining("popup"));
    expect(hook.result.current.phase).toBe("waiting");

    // Still behind the check, then booting, then up.
    checkServer.mockResolvedValueOnce(check).mockResolvedValueOnce(down).mockResolvedValueOnce(up);
    await act(() => vi.advanceTimersByTimeAsync(WAIT_POLL_MS * 3));
    expect(result()).toBe("awake");
    expect(popup.close).toHaveBeenCalled();
    expect(hook.result.current.phase).toBe("idle");
  });

  it("checks at once when the player comes back to the tab", async () => {
    const { hook, result } = start();
    act(() => hook.result.current.openCheck());
    checkServer.mockResolvedValue(up);
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(result()).toBe("awake");
  });

  it("checks at once when the check's window says the server is awake", async () => {
    const { hook, result } = start();
    act(() => hook.result.current.openCheck());
    checkServer.mockResolvedValue(up);
    const listening = channels.find((c) => c.name === AWAKE_CHANNEL && !c.closed);
    expect(listening).toBeDefined();
    await act(async () => {
      listening!.onmessage?.({ data: "awake" });
    });
    expect(result()).toBe("awake");
    expect(toast.success).toHaveBeenCalledWith("The server is awake.");
  });

  it("goes on by itself if the server wakes before the player taps", async () => {
    const { result } = start();
    checkServer.mockResolvedValue(up);
    await act(() => vi.advanceTimersByTimeAsync(ASK_POLL_MS));
    expect(result()).toBe("awake");
    expect(window.open).not.toHaveBeenCalled();
  });

  it("offers a link instead when the browser blocks the window", () => {
    vi.mocked(window.open).mockReturnValue(null);
    const { hook } = start();
    act(() => hook.result.current.openCheck());
    expect(hook.result.current.phase).toBe("blocked");
    act(() => hook.result.current.openedAsLink());
    expect(hook.result.current.phase).toBe("waiting");
  });

  it("gives up if the server still isn't up a few minutes after the tick", async () => {
    const { hook, result } = start();
    act(() => hook.result.current.openCheck());
    await act(() => vi.advanceTimersByTimeAsync(WAIT_MAX_MS + WAIT_POLL_MS));
    expect(result()).toBe("timeout");
    expect(popup.close).not.toHaveBeenCalled();
  });

  it("lets the player cancel", async () => {
    const { hook, result } = start();
    act(() => hook.result.current.cancel());
    await act(() => Promise.resolve());
    expect(result()).toBe("cancelled");
    expect(hook.result.current.phase).toBe("idle");
  });

  it("joins a second ask to the one already showing", async () => {
    const { hook, result } = start();
    let second: WakeResult | undefined;
    act(() => {
      void hook.result.current.ask(WAKE_URL).then((r) => (second = r));
    });
    checkServer.mockResolvedValue(up);
    await act(() => vi.advanceTimersByTimeAsync(ASK_POLL_MS));
    expect(result()).toBe("awake");
    expect(second).toBe("awake");
  });
});
