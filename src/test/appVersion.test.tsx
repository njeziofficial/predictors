import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { bundleIn, newerBundle, runningBundle } from "@/lib/appVersion";

const page = (bundle: string) =>
  `<!doctype html><html><head><script type="module" crossorigin src="${bundle}"></script></head><body></body></html>`;

const serve = (body: string, ok = true) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(body, { status: ok ? 200 : 503 }));

describe("spotting a new version", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.head.innerHTML = "";
  });

  it("reads the main script from the page and from HTML", () => {
    const script = document.createElement("script");
    script.src = "https://octopus.example/assets/index-De3ov05O.js";
    document.head.appendChild(script);

    expect(runningBundle()).toBe("/assets/index-De3ov05O.js");
    expect(bundleIn(page("/assets/index-x4J0ePzD.js"))).toBe("/assets/index-x4J0ePzD.js");
    expect(bundleIn("<html>maintenance</html>")).toBeNull();
  });

  it("reports the live bundle when it differs from the running one", async () => {
    const fetch = serve(page("/assets/index-NEW123.js"));
    expect(await newerBundle("/assets/index-OLD456.js")).toBe("/assets/index-NEW123.js");
    // Asked fresh, never from a cache.
    expect(fetch).toHaveBeenCalledWith("/", expect.objectContaining({ cache: "no-store" }));
  });

  it("says nothing when the same version is live", async () => {
    serve(page("/assets/index-SAME.js"));
    expect(await newerBundle("/assets/index-SAME.js")).toBeNull();
  });

  it("says it can't tell when offline, given an error page, or in development", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));
    expect(await newerBundle("/assets/index-OLD.js")).toBeUndefined();

    vi.restoreAllMocks();
    serve("Service unavailable", false);
    expect(await newerBundle("/assets/index-OLD.js")).toBeUndefined();

    serve("<html>no bundle here</html>");
    expect(await newerBundle("/assets/index-OLD.js")).toBeUndefined();

    // Development: no built bundle on the page, so nothing is fetched.
    const fetch = serve(page("/assets/index-NEW.js"));
    expect(await newerBundle(null)).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("the new-version prompt", () => {
  const running = "/assets/index-OLD456.js";

  beforeEach(() => {
    vi.useFakeTimers();
    const script = document.createElement("script");
    script.src = `https://octopus.example${running}`;
    document.head.appendChild(script);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.head.innerHTML = "";
  });

  const mount = async () => {
    const { default: UpdateAvailable } = await import("@/components/UpdateAvailable");
    render(<UpdateAvailable />);
  };

  it("checks as soon as the app opens", async () => {
    serve(page("/assets/index-NEW123.js"));
    await mount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("A new version of Octopus is available.")).toBeTruthy();
  });

  it("tries again shortly when the phone had no network yet", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("offline"));
    fetch.mockResolvedValue(new Response(page("/assets/index-NEW123.js")));
    await mount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.queryByText("A new version of Octopus is available.")).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(screen.getByText("A new version of Octopus is available.")).toBeTruthy();
  });

  it("stays quiet when the same version is live", async () => {
    serve(page(running));
    await mount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.queryByText("A new version of Octopus is available.")).toBeNull();
  });
});
