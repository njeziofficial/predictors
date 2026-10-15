import { afterEach, describe, expect, it, vi } from "vitest";
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

  it("says nothing when it can't tell: offline, an error page, or in development", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));
    expect(await newerBundle("/assets/index-OLD.js")).toBeNull();

    vi.restoreAllMocks();
    serve("Service unavailable", false);
    expect(await newerBundle("/assets/index-OLD.js")).toBeNull();

    serve("<html>no bundle here</html>");
    expect(await newerBundle("/assets/index-OLD.js")).toBeNull();

    // Development: no built bundle on the page, so nothing is fetched.
    const fetch = serve(page("/assets/index-NEW.js"));
    expect(await newerBundle(null)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
