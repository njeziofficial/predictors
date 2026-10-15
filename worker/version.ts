import { BUNDLE_HEADER, bundleIn } from "../src/lib/appVersion";

// Tells the app which build is live, on every /api response it already makes, so an open app
// learns of a deploy without asking for it separately (see src/lib/appVersion.ts).
export { BUNDLE_HEADER };

interface Assets {
  fetch(request: Request): Promise<Response>;
}

// The deployed index.html's main script. A deploy runs in fresh isolates with its own assets,
// so what one isolate reads stays true for as long as it lives. A failed read is tried again.
let live: Promise<string | null> | null = null;

export const liveBundle = (assets: Assets, origin: string): Promise<string | null> =>
  (live ??= assets
    .fetch(new Request(new URL("/", origin), { headers: { Accept: "text/html" } }))
    .then(async (res) => (res.ok ? bundleIn(await res.text()) : null))
    .catch(() => null)
    .then((bundle) => {
      if (!bundle) live = null;
      return bundle;
    }));

/** For tests: forget the cached bundle. */
export const resetLiveBundle = () => {
  live = null;
};

/** The response with the live build added, unless it's a WebSocket upgrade or the build is unknown. */
export async function withLiveBundle(res: Response, assets: Assets, origin: string): Promise<Response> {
  if (res.status === 101 || (res as Response & { webSocket?: unknown }).webSocket) return res;
  const bundle = await liveBundle(assets, origin);
  if (!bundle) return res;
  const stamped = new Response(res.body, res);
  stamped.headers.set(BUNDLE_HEADER, bundle);
  return stamped;
}
