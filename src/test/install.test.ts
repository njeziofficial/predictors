import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

// The module keeps the browser's install offer in module state, so each test loads it fresh.
const load = async (userAgent: string) => {
  vi.resetModules();
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
  const install = await import("@/lib/install");
  install.listenForInstallPrompt();
  return install;
};

const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36";
const ANDROID_WEBVIEW = "Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

// What Chrome fires when it can install the app.
const offerInstall = (outcome: "accepted" | "dismissed") => {
  const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome }),
  });
  window.dispatchEvent(event);
  return event;
};

describe("installing the app", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
  });
  afterEach(() => vi.restoreAllMocks());

  it("shows how to install from the menu until Chrome offers it, then installs with one tap", async () => {
    const install = await load(ANDROID_CHROME);
    const { result } = renderHook(() => install.useInstallState());
    expect(result.current).toBe("manual");

    let event!: ReturnType<typeof offerInstall>;
    act(() => {
      event = offerInstall("accepted");
    });
    expect(event.defaultPrevented).toBe(true);
    expect(result.current).toBe("prompt");

    let accepted = false;
    await act(async () => {
      accepted = await install.installApp();
    });
    expect(event.prompt).toHaveBeenCalledOnce();
    expect(accepted).toBe(true);

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(result.current).toBe("installed");
  });

  it("can't use Chrome's offer twice", async () => {
    const install = await load(ANDROID_CHROME);
    offerInstall("dismissed");
    expect(await install.installApp()).toBe(false);
    expect(await install.installApp()).toBe(false);
  });

  it("says to open the link in a browser when inside another app", async () => {
    const install = await load(ANDROID_WEBVIEW);
    expect(renderHook(() => install.useInstallState()).result.current).toBe("in-app");
  });

  it("gives the Add to Home Screen steps on iPhone", async () => {
    const install = await load(IPHONE);
    expect(renderHook(() => install.useInstallState()).result.current).toBe("ios");
  });

  it("shows nothing on a computer, even when its browser offers to install, and nothing once installed", async () => {
    const install = await load(DESKTOP);
    const { result } = renderHook(() => install.useInstallState());
    expect(result.current).toBe("none");
    act(() => {
      offerInstall("accepted");
    });
    expect(result.current).toBe("none");

    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    expect(renderHook(() => install.useInstallState()).result.current).toBe("installed");
  });
});
