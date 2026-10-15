import { useEffect, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { newerBundle } from "@/lib/appVersion";

// Checked when the player comes back to the app, and every half hour while it's in front, but at
// most every five minutes: an installed app can sit open in the background for days.
const MIN_GAP_MS = 5 * 60 * 1000;
const POLL_MS = 30 * 60 * 1000;

/**
 * "A new version is available": shown when a newer build has been deployed since this page
 * loaded. It never reloads by itself, which could throw away a half-entered prediction; the
 * player taps Refresh. "Later" hides it until a newer build still comes out.
 */
const UpdateAvailable = () => {
  const [available, setAvailable] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const lastCheck = useRef(0);

  useEffect(() => {
    const check = async () => {
      if (document.visibilityState !== "visible" || Date.now() - lastCheck.current < MIN_GAP_MS) return;
      lastCheck.current = Date.now();
      const newer = await newerBundle();
      if (newer) setAvailable(newer);
    };

    const onVisible = () => void check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", onVisible);
    const timer = window.setInterval(onVisible, POLL_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", onVisible);
      window.clearInterval(timer);
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
