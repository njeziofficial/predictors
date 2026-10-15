import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { BUNDLE_HEADER, NEW_VERSION_EVENT, noteLiveBundle } from "@/lib/appVersion";
import { liveBundle, resetLiveBundle, withLiveBundle } from "../../worker/version";

const page = (bundle: string) => `<!doctype html><html><head><script type="module" src="${bundle}"></script></head></html>`;
const assetsServing = (html: string, status = 200) => ({ fetch: vi.fn(async () => new Response(html, { status })) });

describe("the Worker telling the app which build is live", () => {
  beforeEach(() => resetLiveBundle());

  it("adds the live build to API answers, reading the page once", async () => {
    const assets = assetsServing(page("/assets/index-NEW123.js"));
    const first = await withLiveBundle(Response.json({ ok: true }, { status: 201 }), assets, "https://octopus.example");
    const second = await withLiveBundle(new Response("x"), assets, "https://octopus.example");

    expect(first.headers.get(BUNDLE_HEADER)).toBe("/assets/index-NEW123.js");
    expect(first.status).toBe(201);
    expect(await first.json()).toEqual({ ok: true });
    expect(second.headers.get(BUNDLE_HEADER)).toBe("/assets/index-NEW123.js");
    expect(assets.fetch).toHaveBeenCalledTimes(1);
  });

  it("leaves answers alone when it can't read the build, and tries again next time", async () => {
    const broken = assetsServing("oops", 500);
    const res = await withLiveBundle(new Response("x"), broken, "https://octopus.example");
    expect(res.headers.get(BUNDLE_HEADER)).toBeNull();

    const fixed = assetsServing(page("/assets/index-NEW123.js"));
    expect(await liveBundle(fixed, "https://octopus.example")).toBe("/assets/index-NEW123.js");
  });
});

describe("the app hearing of a new build", () => {
  const running = "/assets/index-OLD456.js";
  const headers = (bundle?: string) => new Headers(bundle ? { [BUNDLE_HEADER]: bundle } : {});

  afterEach(() => {
    vi.restoreAllMocks();
    document.head.innerHTML = "";
  });

  it("announces only a different, well-formed build", () => {
    const heard = vi.fn();
    window.addEventListener(NEW_VERSION_EVENT, heard);
    noteLiveBundle(headers(running), running);
    noteLiveBundle(headers(), running);
    noteLiveBundle(headers("<script>"), running);
    noteLiveBundle(headers("/assets/index-NEW123.js"), null); // development
    expect(heard).not.toHaveBeenCalled();

    noteLiveBundle(headers("/assets/index-NEW123.js"), running);
    expect(heard).toHaveBeenCalledTimes(1);
    expect((heard.mock.calls[0][0] as CustomEvent).detail).toBe("/assets/index-NEW123.js");
    window.removeEventListener(NEW_VERSION_EVENT, heard);
  });

  it("shows the prompt when an API answer reports a newer build", async () => {
    const script = document.createElement("script");
    script.src = `https://octopus.example${running}`;
    document.head.appendChild(script);
    // The check on opening finds nothing new.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(page(running)));
    const { default: UpdateAvailable } = await import("@/components/UpdateAvailable");
    render(<UpdateAvailable />);
    await act(async () => {});
    expect(screen.queryByText("A new version of Octopus is available.")).toBeNull();

    await act(async () => noteLiveBundle(headers("/assets/index-NEW123.js")));
    expect(screen.getByText("A new version of Octopus is available.")).toBeTruthy();
  });
});
