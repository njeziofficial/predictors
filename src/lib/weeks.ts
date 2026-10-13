import type { MatchWeekDto } from "@/lib/api";

const time = (iso: string) => new Date(iso).getTime();

export const firstKickoff = (w: MatchWeekDto) => Math.min(...w.fixtures.map((f) => time(f.kickoff)));

/**
 * Knockout weeks whose matches can go to extra time (a 2nd leg, the final). Their results are
 * the score after 90 minutes; mirrors CompetitionRounds.CanGoToExtraTime on the backend.
 */
export const canGoToExtraTime = (w: Pick<MatchWeekDto, "id">) => /-(leg2|final)$/.test(w.id);

/** The week's name without its competition: "Week 8", "Round of 16 — 1st leg". */
export const weekLabel = (w: Pick<MatchWeekDto, "name" | "competition">) => w.name.replace(`${w.competition} — `, "");

export const nextKickoff =(w: MatchWeekDto): number | null => {
  const upcoming = w.fixtures.filter((f) => f.status === "pre_match").map((f) => time(f.kickoff));
  return upcoming.length > 0 ? Math.min(...upcoming) : null;
};

/** Weeks with fixtures, oldest first. */
export const sortWeeks = (weeks: MatchWeekDto[]) =>
  weeks.filter((w) => w.fixtures.length > 0).sort((a, b) => firstKickoff(a) - firstKickoff(b));

/**
 * The week players are predicting now: the one whose next match kicks off soonest. A fixture
 * whose kickoff has passed doesn't count even if it's still marked pre-match (the scraper can
 * lag, or a match is never updated). With nothing upcoming, the most recent week.
 */
export const activeWeek = (weeks: MatchWeekDto[], now = Date.now()): MatchWeekDto | undefined => {
  const sorted = sortWeeks(weeks);
  const upcoming = (w: MatchWeekDto) => {
    const k = nextKickoff(w);
    return k !== null && k > now ? k : null;
  };
  const open = sorted.filter((w) => upcoming(w) !== null).sort((a, b) => upcoming(a)! - upcoming(b)!);
  return open[0] ?? sorted[sorted.length - 1];
};
