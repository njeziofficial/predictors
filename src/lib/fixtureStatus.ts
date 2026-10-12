import type { FixtureDto, ScoreDto } from "@/lib/api";

export type FixtureDisplayState =
  | "upcoming"
  | "awaiting_kickoff"
  | "live"
  | "full_time"
  | "postponed"
  | "cancelled";

export interface FixtureDisplay {
  state: FixtureDisplayState;
  /** Score to show, or null when there isn't a trustworthy one. */
  score: ScoreDto | null;
  /** Short status text for players; null for an upcoming match (its kickoff time says enough). */
  label: string | null;
}

/**
 * The score a called-off match reached before it was stopped, or null if it never got going.
 * The backend keeps the last live reading when a match is postponed or cancelled. A recorded
 * minute or a goal proves play happened; a bare 0–0 with no minute is a leftover placeholder.
 */
function scoreWhenStopped(f: FixtureDto): ScoreDto | null {
  const score = f.liveScore ?? f.finalScore;
  if (!score) return null;
  return f.liveMinute != null || score.home + score.away > 0 ? score : null;
}

function calledOff(f: FixtureDto, state: "postponed" | "cancelled"): FixtureDisplay {
  const word = state === "postponed" ? "Postponed" : "Cancelled";
  const score = scoreWhenStopped(f);
  if (!score) return { state, score: null, label: word };
  return { state, score, label: f.liveMinute != null ? `${word} at ${f.liveMinute}'` : `${word} mid-match` };
}

/**
 * What a player should see for a match. A score is only shown when the status backs it up: a
 * called-off match can keep a stale scraped 0–0, and an unstarted match has no score at all.
 */
export function fixtureDisplay(f: FixtureDto, now: Date): FixtureDisplay {
  switch (f.status) {
    case "postponed":
    case "cancelled":
      return calledOff(f, f.status);
    case "live":
      return {
        state: "live",
        score: f.liveScore ?? f.finalScore,
        label: f.liveMinute != null ? `Live ${f.liveMinute}'` : "Live",
      };
    case "ended": {
      const score = f.finalScore ?? f.liveScore;
      return { state: "full_time", score, label: score ? "FT" : "FT · result pending" };
    }
    default:
      // Kickoff has passed but no live update has arrived yet.
      return new Date(f.kickoff) <= now
        ? { state: "awaiting_kickoff", score: null, label: "Awaiting kick-off" }
        : { state: "upcoming", score: null, label: null };
  }
}

/** One-line status for compact lists, e.g. "FT 2-1", "Live 67' 1-0", "Postponed". */
export function fixtureStatusText(f: FixtureDto, now: Date): string {
  const { score, label } = fixtureDisplay(f, now);
  if (!label) return "";
  return score ? `${label} ${score.home}-${score.away}` : label;
}
