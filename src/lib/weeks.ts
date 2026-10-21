import type { FixtureDto, MatchWeekDto } from "@/lib/api";

const time = (iso: string) => new Date(iso).getTime();

export const firstKickoff = (w: MatchWeekDto) => Math.min(...w.fixtures.map((f) => time(f.kickoff)));

/**
 * Knockout weeks whose matches can go to extra time (a 2nd leg, the final). Their results are
 * the score after 90 minutes; mirrors CompetitionRounds.CanGoToExtraTime on the backend.
 */
export const canGoToExtraTime = (w: Pick<MatchWeekDto, "id">) => /-(leg2|final)$/.test(w.id);

/** The week's name without its competition: "Week 8", "Round of 16 — 1st leg". */
export const weekLabel = (w: Pick<MatchWeekDto, "name" | "competition">) => w.name.replace(`${w.competition} — `, "");

export const nextKickoff = (w: MatchWeekDto, ignore: ReadonlySet<string> = new Set()): number | null => {
  const upcoming = w.fixtures
    .filter((f) => f.status === "pre_match" && !ignore.has(f.id))
    .map((f) => time(f.kickoff));
  return upcoming.length > 0 ? Math.min(...upcoming) : null;
};

const isPlayable = (f: FixtureDto) => f.status !== "postponed" && f.status !== "cancelled";

/**
 * Matches moved out of their own week: they kick off after the competition's next week has
 * started (a postponed match played weeks later, even one postponed before the app had it).
 * They're predicted on their own, each locking at its own kickoff. Mirrors RescheduledFixtures
 * on the backend.
 */
export function rescheduledFixtureIds(weeks: MatchWeekDto[]): Set<string> {
  const starts = weeks.flatMap((w) => {
    const kickoffs = w.fixtures.filter(isPlayable).map((f) => time(f.kickoff));
    return kickoffs.length > 0 ? [{ week: w, start: Math.min(...kickoffs) }] : [];
  });
  const ids = new Set<string>();
  for (const { week, start } of starts) {
    const later = starts
      .filter((s) => s.week.competitionId === week.competitionId && s.week.id !== week.id && s.start > start)
      .map((s) => s.start);
    if (later.length === 0) continue;
    const nextWeekStart = Math.min(...later);
    for (const f of week.fixtures) if (time(f.kickoff) > nextWeekStart) ids.add(f.id);
  }
  return ids;
}

/** Weeks with fixtures, oldest first. */
export const sortWeeks = (weeks: MatchWeekDto[]) =>
  weeks.filter((w) => w.fixtures.length > 0).sort((a, b) => firstKickoff(a) - firstKickoff(b));

/**
 * The week players are predicting now: the one whose next match kicks off soonest. A fixture
 * whose kickoff has passed doesn't count even if it's still marked pre-match (the scraper can
 * lag, or a match is never updated). Rescheduled matches don't count either: an old week isn't
 * current again because one of its matches is replayed. With nothing upcoming, the most recent week.
 */
export const activeWeek = (weeks: MatchWeekDto[], now = Date.now()): MatchWeekDto | undefined => {
  const sorted = sortWeeks(weeks);
  const rescheduled = rescheduledFixtureIds(weeks);
  const upcoming = (w: MatchWeekDto) => {
    const k = nextKickoff(w, rescheduled);
    return k !== null && k > now ? k : null;
  };
  const open = sorted.filter((w) => upcoming(w) !== null).sort((a, b) => upcoming(a)! - upcoming(b)!);
  return open[0] ?? sorted[sorted.length - 1];
};
