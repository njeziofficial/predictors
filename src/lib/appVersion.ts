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
 * The live index.html's main script if it differs from the one running, else null. Null too
 * when it can't tell (offline, development, an unexpected page).
 */
export async function newerBundle(running = runningBundle()): Promise<string | null> {
  if (!running) return null;
  try {
    const response = await fetch("/", { cache: "no-store", headers: { Accept: "text/html" } });
    if (!response.ok) return null;
    const live = bundleIn(await response.text());
    return live && live !== running ? live : null;
  } catch {
    return null;
  }
}
