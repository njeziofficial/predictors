import { useNavigate } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { Crown, Medal, ChevronRight, Target } from "lucide-react";
import { api, type LeaderboardEntryDto, type MatchWeekDto } from "@/lib/api";

// Gold, silver, bronze — indexed by finishing place - 1.
const MEDALS = [
  {
    label: "1st",
    ring: "ring-amber-400",
    text: "text-amber-400",
    badge: "bg-amber-400 text-amber-950",
    plinth: "from-amber-400/30 via-amber-400/10 to-transparent border-amber-400/40",
    dot: "bg-amber-400",
  },
  {
    label: "2nd",
    ring: "ring-slate-300",
    text: "text-slate-300",
    badge: "bg-slate-300 text-slate-900",
    plinth: "from-slate-300/25 via-slate-300/5 to-transparent border-slate-300/30",
    dot: "bg-slate-300",
  },
  {
    label: "3rd",
    ring: "ring-orange-600",
    text: "text-orange-500",
    badge: "bg-orange-600 text-orange-50",
    plinth: "from-orange-600/25 via-orange-600/5 to-transparent border-orange-600/30",
    dot: "bg-orange-600",
  },
] as const;

interface WeekChampions {
  week: MatchWeekDto;
  winners: LeaderboardEntryDto[];
  final: boolean;
}

const hasStarted = (w: MatchWeekDto) => w.fixtures.some(f => f.status !== "pre_match");
const isFinal = (w: MatchWeekDto) =>
  w.fixtures.length > 0 && w.fixtures.every(f => f.status !== "pre_match" && f.status !== "live");
const firstKickoff = (w: MatchWeekDto) =>
  Math.min(...w.fixtures.map(f => new Date(f.kickoff).getTime()));

const shortWeekName = (w: MatchWeekDto) => w.name.replace(/.*—\s*/, "");

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]!.toUpperCase())
    .join("");

/**
 * Top three scorers of each started week, newest week first. Only players who scored count,
 * so a week where nobody has scored yet is left out. Pass `onlyFinal` to skip weeks still in play.
 */
function useWeeklyChampions(
  weeks: MatchWeekDto[],
  opts: { enabled: boolean; onlyFinal?: boolean; limit?: number },
) {
  const candidates = weeks
    .filter(w => (opts.onlyFinal ? isFinal(w) : hasStarted(w)))
    .sort((a, b) => firstKickoff(b) - firstKickoff(a))
    .slice(0, opts.limit ?? Infinity);

  const results = useQueries({
    queries: candidates.map(w => ({
      // Same key as the weekly standings so both views share the cache.
      queryKey: ["leaderboard-week", w.id],
      queryFn: () => api.leaderboard.byWeek(w.id),
      staleTime: 60_000,
      enabled: opts.enabled,
    })),
  });

  const champions: WeekChampions[] = candidates
    .map((week, i) => ({
      week,
      winners: (results[i]?.data ?? []).filter(e => e.totalPoints > 0).slice(0, 3),
      final: isFinal(week),
    }))
    .filter(c => c.winners.length > 0);

  return { champions, isLoading: results.some(r => r.isLoading) };
}

const PodiumSpot = ({
  entry,
  place,
  isMe,
}: {
  entry: LeaderboardEntryDto | undefined;
  place: 0 | 1 | 2;
  isMe: boolean;
}) => {
  const medal = MEDALS[place];
  const champion = place === 0;
  const plinthHeight = ["h-20", "h-14", "h-10"][place];

  return (
    <div className={`flex flex-col items-center min-w-0 flex-1 ${champion ? "-mt-2" : "mt-6"}`}>
      {champion && <Crown className="h-5 w-5 text-amber-400 mb-1 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" />}
      <div className="relative">
        <div
          className={`rounded-full ring-2 ${medal.ring} ring-offset-2 ring-offset-card bg-secondary flex items-center justify-center font-bold ${
            champion ? "h-16 w-16 text-lg" : "h-12 w-12 text-sm"
          } ${entry ? "" : "opacity-40"}`}
        >
          {entry ? initials(entry.name) : "–"}
        </div>
        <span
          className={`absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full px-1.5 py-px text-[10px] font-bold shadow ${medal.badge}`}
        >
          {medal.label}
        </span>
      </div>

      <p className="mt-4 text-xs sm:text-sm font-semibold truncate max-w-full px-1" title={entry?.name}>
        {entry ? entry.name : "No scorer"}
      </p>
      {isMe && (
        <span className="mt-0.5 rounded-full bg-primary/15 px-1.5 text-[10px] font-medium text-primary">You</span>
      )}
      <p className={`mt-1 font-bold tabular-nums ${champion ? "text-2xl" : "text-lg"} ${entry ? medal.text : "text-muted-foreground"}`}>
        {entry?.totalPoints ?? 0}
        <span className="ml-0.5 text-[10px] font-medium text-muted-foreground">pts</span>
      </p>
      {entry && entry.correctScores > 0 && (
        <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Target className="h-3 w-3" />
          {entry.correctScores} correct score{entry.correctScores === 1 ? "" : "s"}
        </p>
      )}

      <div className={`mt-2 w-full ${plinthHeight} rounded-t-md border-x border-t bg-gradient-to-b ${medal.plinth}`} />
    </div>
  );
};

/** Featured card for one week's top three, laid out as a podium (2nd · 1st · 3rd). */
export const ChampionsSpotlight = ({
  data,
  currentUserId,
  onViewAll,
}: {
  data: WeekChampions;
  currentUserId: string;
  onViewAll?: () => void;
}) => {
  const [first, second, third] = data.winners;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-amber-400/20 bg-card fade-in-up">
      {/* Soft gold glow behind the champion */}
      <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-amber-400/10 blur-3xl" />

      <header className="relative flex items-center justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-400/90">
            Weekly Champions
          </p>
          <h2 className="text-lg font-bold truncate">
            {shortWeekName(data.week)}
            <span className="ml-2 text-xs font-normal text-muted-foreground">{data.week.competition}</span>
          </h2>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
            data.final ? "bg-success/15 text-success" : "bg-primary/15 text-primary"
          }`}
        >
          {data.final ? "Final" : "Provisional"}
        </span>
      </header>

      <div className="relative flex items-start gap-2 px-3 pt-4 sm:px-6">
        <PodiumSpot entry={second} place={1} isMe={second?.userId === currentUserId} />
        <PodiumSpot entry={first} place={0} isMe={first?.userId === currentUserId} />
        <PodiumSpot entry={third} place={2} isMe={third?.userId === currentUserId} />
      </div>

      {onViewAll && (
        <button
          onClick={onViewAll}
          className="relative flex w-full items-center justify-center gap-1 border-t border-border py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground"
        >
          All weekly champions
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </section>
  );
};

/** Latest finished week's champions, for pages everyone lands on. Renders nothing until there is one. */
export const LatestChampions = ({ weeks, currentUserId }: { weeks: MatchWeekDto[]; currentUserId: string }) => {
  const navigate = useNavigate();
  const { champions } = useWeeklyChampions(weeks, { enabled: true, onlyFinal: true, limit: 1 });
  if (champions.length === 0) return null;
  return (
    <ChampionsSpotlight
      data={champions[0]}
      currentUserId={currentUserId}
      onViewAll={() => navigate("/leaderboard?tab=champions")}
    />
  );
};

/** Every week's top three: the newest as a spotlight, earlier weeks as a roll of honour. */
const WeeklyChampions = ({ weeks, currentUserId }: { weeks: MatchWeekDto[]; currentUserId: string }) => {
  const { champions, isLoading } = useWeeklyChampions(weeks, { enabled: true });

  if (champions.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <Medal className="mx-auto mb-2 h-8 w-8 text-muted-foreground opacity-50" />
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Loading champions…" : "Champions appear here once a week's matches have been scored."}
        </p>
      </div>
    );
  }

  const [latest, ...earlier] = champions;

  return (
    <div className="space-y-6">
      <ChampionsSpotlight data={latest} currentUserId={currentUserId} />

      {earlier.length > 0 && (
        <section className="space-y-2">
          <h3 className="px-1 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Roll of honour
          </h3>
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {earlier.map(({ week, winners, final }) => (
              <div key={week.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="sm:w-28 shrink-0">
                  <p className="text-sm font-semibold">{shortWeekName(week)}</p>
                  {!final && <p className="text-[10px] text-primary">Provisional</p>}
                </div>
                <ol className="grid flex-1 grid-cols-3 gap-2">
                  {[0, 1, 2].map(place => {
                    const e = winners[place];
                    const medal = MEDALS[place];
                    const isMe = e?.userId === currentUserId;
                    return (
                      <li
                        key={place}
                        className={`flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1.5 ${
                          isMe ? "bg-primary/10" : "bg-secondary/50"
                        }`}
                      >
                        <span className={`h-2 w-2 shrink-0 rounded-full ${medal.dot}`} />
                        <span className="min-w-0 flex-1 truncate text-xs" title={e?.name}>
                          {e ? (isMe ? "You" : e.name.split(" ")[0]) : "—"}
                        </span>
                        {e && <span className={`text-xs font-bold tabular-nums ${medal.text}`}>{e.totalPoints}</span>}
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default WeeklyChampions;
