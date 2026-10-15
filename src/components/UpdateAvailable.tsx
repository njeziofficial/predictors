import { useEffect, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NEW_VERSION_EVENT, newerBundle } from "@/lib/appVersion";

// While the app is open, every API answer says which build is live (the Worker adds it; see
// noteLiveBundle), so a deploy is noticed with no extra requests. One direct check runs when the
// app opens and when the player comes back to it (at most every five minutes), which also covers
// the sign-in pages, where the app makes no API calls.
const MIN_GAP_MS = 5 * 60 * 1000;
// A phone coming back from the background often has no network for a few seconds, so a check
// that couldn't get an answer is tried again shortly.
const RETRY_MS = 15 * 1000;

/**
 * "A new version is available": shown when a newer build has been deployed since this page
 * loaded. It never reloads by itself, which could throw away a half-entered prediction; the
 * player taps Refresh. "Later" hides it until a newer build still comes out.
 */
const UpdateAvailable = () => {
  const [available, setAvailable] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  // When the last check got an answer; a check that couldn't doesn't count.
  const lastAnswer = useRef(0);
  const checking = useRef(false);

  useEffect(() => {
    let retry: number | undefined;

    const check = async () => {
      if (document.visibilityState !== "visible" || checking.current) return;
      if (Date.now() - lastAnswer.current < MIN_GAP_MS) return;
      checking.current = true;
      window.clearTimeout(retry);
      try {
        const newer = await newerBundle();
        if (newer === undefined) {
          retry = window.setTimeout(() => void check(), RETRY_MS);
          return;
        }
        lastAnswer.current = Date.now();
        if (newer) setAvailable(newer);
      } finally {
        checking.current = false;
      }
    };

    const onVisible = () => void check();
    const onNewVersion = (e: Event) => {
      const live = (e as CustomEvent<string>).detail;
      if (live) setAvailable(live);
    };
    // Also on opening: a phone may show a page it kept from before the update.
    onVisible();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", onVisible);
    window.addEventListener("pageshow", onVisible);
    window.addEventListener(NEW_VERSION_EVENT, onNewVersion);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", onVisible);
      window.removeEventListener("pageshow", onVisible);
      window.removeEventListener(NEW_VERSION_EVENT, onNewVersion);
      window.clearTimeout(retry);
    };
  }, []);

  if (!available || dismissed === available) return null;

  const refresh = async () => {
    // Pick up a newer notification handler too, then load the new version.
    try {
      await (await navigator.serviceWorker?.getRegistration())?.update();
    } catch {
      // The page still reloads.
    }
    window.location.reload();
  };

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pointer-events-none"
    >
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border border-primary/40 bg-card px-4 py-3 shadow-xl shadow-black/40">
        <RefreshCw className="h-4 w-4 shrink-0 text-primary" />
        <p className="flex-1 text-sm">A new version of Octopus is available.</p>
        <Button size="sm" onClick={refresh}>
          Refresh
        </Button>
        <button
          onClick={() => setDismissed(available)}
          aria-label="Later"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default UpdateAvailable;
