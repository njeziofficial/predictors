// Whether a newer version of the app has been deployed since this page loaded. Each build's main
// script has a content hash in its name (/assets/index-De3ov05O.js), so the page compares the one
// it's running with the one the live index.html points at. No version file or build step needed.

const BUNDLE = /\/assets\/index-[\w-]+\.js/;

/** The main script this page loaded; null in development, where there's no built bundle. */
export const runningBundle = (): string | null => {
  const script = Array.from(document.scripts).find((s) => BUNDLE.test(s.src));
  return script ? (script.src.match(BUNDLE)?.[0] ?? null) : null;
};

/** The main script in a page's HTML, or null. */
export const bundleIn = (html: string): string | null => html.match(BUNDLE)?.[0] ?? null;

/**
 * The live index.html's main script if it differs from the one running, or null when the same
 * one is live. Undefined when it can't tell (offline, the server waking, an unexpected page,
 * development), so the caller can ask again soon instead of waiting for its next check.
 */
export async function newerBundle(running = runningBundle()): Promise<string | null | undefined> {
  if (!running) return undefined;
  try {
    const response = await fetch("/", { cache: "no-store", headers: { Accept: "text/html" } });
    if (!response.ok) return undefined;
    const live = bundleIn(await response.text());
    if (!live) return undefined;
    return live !== running ? live : null;
  } catch {
    return undefined;
  }
}

// Fired on window with the live bundle as detail, when an API answer shows a newer build is out.
export const NEW_VERSION_EVENT = "op-new-version";
// Sent by the Cloudflare Worker on every /api answer (worker/version.ts).
export const BUNDLE_HEADER = "X-App-Bundle";

/**
 * Reads the live build from an API answer's headers and announces it when it differs from the
 * one running. The app makes these calls anyway, so a deploy is noticed without asking for it.
 */
export function noteLiveBundle(headers: Headers, running = runningBundle()): void {
  const live = headers.get(BUNDLE_HEADER);
  if (!running || !live || !BUNDLE.test(live) || live === running) return;
  window.dispatchEvent(new CustomEvent(NEW_VERSION_EVENT, { detail: live }));
}
