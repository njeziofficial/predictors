import type { FixtureDto } from "@/lib/api";
import { fixtureDisplay, type FixtureDisplayState } from "@/lib/fixtureStatus";
import { cn } from "@/lib/utils";

const BOX: Record<FixtureDisplayState, string> = {
  upcoming: "bg-secondary text-muted-foreground",
  awaiting_kickoff: "bg-secondary text-muted-foreground",
  live: "bg-success/20 text-success",
  full_time: "bg-secondary",
  postponed: "border border-destructive/30 bg-destructive/10 text-destructive",
  cancelled: "border border-destructive/30 bg-destructive/10 text-destructive",
};

const CAPTION: Partial<Record<FixtureDisplayState, string>> = {
  awaiting_kickoff: "text-muted-foreground",
  live: "text-success font-semibold",
  full_time: "text-muted-foreground font-semibold",
  postponed: "text-destructive font-semibold",
  cancelled: "text-destructive font-semibold",
};

/** The score box between the team names, with the match status under it. */
export default function FixtureScore({ fixture, now }: { fixture: FixtureDto; now: Date }) {
  const { state, score, label } = fixtureDisplay(fixture, now);
  // Called off before a ball was kicked: the status itself goes in the box.
  const wordInBox = (state === "postponed" || state === "cancelled") && !score;

  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <span
        className={cn(
          "px-3 py-1 rounded",
          BOX[state],
          wordInBox ? "text-xs font-semibold uppercase tracking-wide" : score ? "font-bold text-sm" : "text-xs",
        )}
      >
        {wordInBox ? label : score ? `${score.home} – ${score.away}` : "vs"}
      </span>
      {!wordInBox && label && (
        <span className={cn("flex items-center gap-1 text-[10px] uppercase tracking-wide", CAPTION[state])}>
          {state === "live" && <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />}
          {label}
        </span>
      )}
    </div>
  );
}
