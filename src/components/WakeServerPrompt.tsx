import { ExternalLink, Loader2, MoonStar } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WakeServer } from "@/hooks/useWakeServer";

/**
 * Asks the player for the one tap that wakes the server when Render's edge wants a person to tick
 * "I'm human" (see useWakeServer). Shows nothing when there's nothing to ask.
 */
const WakeServerPrompt = ({ wake, className = "" }: { wake: WakeServer; className?: string }) => {
  const { phase, wakeUrl, openCheck, openedAsLink, cancel } = wake;
  if (phase === "idle" || !wakeUrl) return null;

  return (
    <div
      className={`rounded-lg border border-primary/30 bg-primary/5 px-4 py-3.5 text-xs ${className}`}
      data-testid="wake-server-prompt"
    >
      <div className="flex items-start gap-2.5">
        <MoonStar className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-semibold">The server is asleep</p>

          {/* Announced as it changes, for screen readers. */}
          <p className="text-muted-foreground" role="status" aria-live="polite">
            {phase === "ask" &&
              "Our host asks for a quick \"I'm human\" check before it starts the server. Tap below, tick the box in the window that opens, and we'll do the rest."}
            {phase === "waiting" &&
              "Tick the box in the window that opened. Then the server takes up to a minute to start, and we'll carry on by ourselves. If the window stays open afterwards, you can close it."}
            {phase === "blocked" &&
              "Your browser didn't open the window. Open the check in a new tab, tick the box, then come back to this tab."}
          </p>

          {phase === "ask" && (
            <Button type="button" className="h-10 w-full text-sm font-semibold" onClick={openCheck}>
              Wake the server
            </Button>
          )}

          {phase === "blocked" && (
            <Button asChild className="h-10 w-full text-sm font-semibold">
              <a href={wakeUrl} target="_blank" rel="noopener noreferrer" onClick={openedAsLink}>
                Open the check in a new tab
                <ExternalLink className="ml-2 h-4 w-4" aria-hidden />
              </a>
            </Button>
          )}

          {phase === "waiting" && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              <span>Waiting for the server…</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-0.5">
            {phase === "waiting" ? (
              // The window may have been closed, or never shown: offer it again.
              <button type="button" className="font-medium text-primary hover:underline" onClick={openCheck}>
                Didn't see the check? Open it again
              </button>
            ) : (
              <span />
            )}
            <button type="button" className="text-muted-foreground hover:text-foreground hover:underline" onClick={cancel}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WakeServerPrompt;
