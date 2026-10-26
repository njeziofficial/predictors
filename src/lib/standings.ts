import type { LeaderboardEntryDto } from "@/lib/api";

const time = (iso: string | null) => (iso ? new Date(iso).getTime() : null);

/**
 * The season table as it stood after a week: points carried over from before the app plus every
 * week's points up to and including it, ranked as the backend ranks the season table (points,
 * then correct scores, then earliest last submission, players who never submitted last).
 *
 * `weeklyBoards` is every week of the competition that has points, oldest first, and `through`
 * how many of them count. The season board gives the carried-over points; its correct scores less
 * all the weeks' give the carried-over correct scores, which it doesn't list on their own.
 */
export function standingsThrough(
  overall: LeaderboardEntryDto[],
  weeklyBoards: LeaderboardEntryDto[][],
  through: number,
): LeaderboardEntryDto[] {
  const rows = overall.map((o) => {
    let points = o.previousPoints;
    let correct = o.correctScores;
    let last: number | null = null;
    weeklyBoards.forEach((board, i) => {
      const w = board.find((e) => e.userId === o.userId);
      if (!w) return;
      if (i < through) {
        points += w.totalPoints;
        const t = time(w.lastSubmittedAt);
        if (t !== null && (last === null || t > last)) last = t;
      } else {
        correct -= w.correctScores;
      }
    });
    return { o, points, correct, last: last as number | null };
  });

  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.correct - a.correct ||
      (a.last === b.last ? 0 : a.last === null ? 1 : b.last === null ? -1 : a.last - b.last),
  );

  return rows.map(({ o, points, correct, last }, i) => ({
    ...o,
    totalPoints: points,
    correctScores: correct,
    position: i + 1,
    lastSubmittedAt: last === null ? null : new Date(last).toISOString(),
  }));
}
