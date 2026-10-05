import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { useQuery, useQueries } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PredictionDto, MatchWeekDto } from "@/lib/api";
import { ChevronDown, ChevronUp, Trophy, Star, CheckCircle2, TrendingUp, History } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import NavBar from "@/components/NavBar";

interface WeekSummary {
  weekId: string;
  weekName: string;
  totalPoints: number;
  predictions: PredictionDto[];
  week: MatchWeekDto | undefined;
}

const Dashboard = () => {
  const { currentUser } = useApp();
  const navigate = useNavigate();
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);

  const { data: allPredictions = [], error: predsError } = useQuery({
    queryKey: ["predictions-all"],
    queryFn: () => api.predictions.mine(),
    enabled: !!currentUser,
  });

  const { data: weeks = [], error: weeksError } = useQuery({
    queryKey: ["weeks"],
    queryFn: api.weeks.list,
    enabled: !!currentUser,
  });

  const { data: overallLeaderboard = [] } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: api.leaderboard.overall,
    enabled: !!currentUser,
  });

  const { data: previousPoints = [] } = useQuery({
    queryKey: ["previous-points-mine"],
    queryFn: api.users.previousPoints,
    enabled: !!currentUser,
  });

  const weekSummaries = useMemo<WeekSummary[]>(() => {
    const map = new Map<string, PredictionDto[]>();
    allPredictions.forEach(p => {
      if (!map.has(p.weekId)) map.set(p.weekId, []);
      map.get(p.weekId)!.push(p);
    });
    return Array.from(map.entries())
      .map(([weekId, preds]) => {
        const week = weeks.find(w => w.id === weekId);
        const totalPoints = preds.reduce((s, p) => s + p.pointsEarned, 0);
        return { weekId, weekName: week?.name ?? weekId, totalPoints, predictions: preds, week };
      })
      .filter(s => s.week?.fixtures.some(f => f.status === "ended"))
      .sort((a, b) => a.weekId.localeCompare(b.weekId));
  }, [allPredictions, weeks]);

  const weeklyLeaderboardQueries = useQueries({
    queries: weekSummaries.map(s => ({
      queryKey: ["leaderboard", s.weekId],
      queryFn: () => api.leaderboard.byWeek(s.weekId),
      staleTime: 60_000,
      enabled: !!currentUser,
    })),
  });

  useEffect(() => {
    if (!currentUser) navigate("/");
  }, [currentUser, navigate]);

  if (!currentUser) return null;

  if (predsError || weeksError) {
    return (
      <div className="min-h-screen bg-background pb-8">
        <NavBar />
        <div className="mx-auto max-w-2xl px-4 pt-12">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
            <p className="text-sm text-destructive font-medium">Failed to load history</p>
            <p className="text-xs text-destructive/80 mt-1">
              {predsError instanceof Error ? predsError.message : weeksError instanceof Error ? weeksError.message : "Unknown error"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const weeklyRankMap = new Map<string, number>();
  weekSummaries.forEach((s, i) => {
    const data = weeklyLeaderboardQueries[i]?.data;
    if (data) {
      const entry = data.find(e => e.userId === currentUser.id);
      if (entry) weeklyRankMap.set(s.weekId, entry.position);
    }
  });

  const previousPts = previousPoints.reduce((s, p) => s + p.points, 0);
  const totalPts = weekSummaries.reduce((s, h) => s + h.totalPoints, 0) + previousPts;
  const totalPreds = weekSummaries.reduce((s, h) => s + h.predictions.length, 0);
  const correctPreds = weekSummaries.reduce((s, h) => s + h.predictions.filter(p => p.pointsEarned > 0).length, 0);
  const accuracy = totalPreds > 0 ? Math.round((correctPreds / totalPreds) * 100) : 0;
  const weeksPlayed = weekSummaries.length;
  const overallRank = overallLeaderboard.find(e => e.userId === currentUser.id)?.position ?? null;

  const bestWeek = weekSummaries.reduce<WeekSummary | null>((best, h) => {
    if (!best || h.totalPoints > best.totalPoints) return h;
    return best;
  }, null);

  const chartData = weekSummaries.map(h => ({
    name: h.weekName.replace(/.*—\s*/, ""),
    points: h.totalPoints,
  }));

  const reversedSummaries = [...weekSummaries].reverse();

  return (
    <div className="min-h-screen bg-background pb-8 page-transition">
      <NavBar />

      <div className="mx-auto max-w-2xl px-4 pt-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">My History</h1>
          <p className="text-sm text-muted-foreground">Season stats and weekly prediction breakdown</p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-lg border border-primary/50 bg-primary/10 p-3 text-center">
            <p className="text-lg font-bold text-primary">{totalPts}</p>
            <p className="text-[10px] text-muted-foreground">Total pts</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-lg font-bold">{accuracy}%</p>
            <p className="text-[10px] text-muted-foreground">Accuracy</p>
            <p className="text-[9px] text-muted-foreground">{correctPreds}/{totalPreds}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-lg font-bold">{weeksPlayed}</p>
            <p className="text-[10px] text-muted-foreground">Weeks played</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-lg font-bold">{overallRank !== null ? `#${overallRank}` : "-"}</p>
            <p className="text-[10px] text-muted-foreground">Overall rank</p>
          </div>
        </div>

        {/* Points carried over from predicting before the app */}
        {previousPoints.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
            <History className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Previous points</p>
              <p className="text-xs text-muted-foreground">
                {previousPoints.length === 1
                  ? previousPoints[0].label
                  : previousPoints.map(p => `${p.label}: ${p.points}`).join(" · ")}
                {" · included in your total"}
              </p>
            </div>
            <p className="text-2xl font-bold text-primary">{previousPts}</p>
          </div>
        )}

        {/* Points per week chart */}
        {chartData.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Points per week</span>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(215 15% 50%)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215 15% 50%)" }} axisLine={false} tickLine={false} width={30} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(215 25% 10%)",
                    border: "1px solid hsl(215 20% 18%)",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "hsl(210 20% 92%)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="points"
                  stroke="hsl(21 90% 48%)"
                  strokeWidth={2}
                  dot={{ fill: "hsl(21 90% 48%)", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Best week highlight */}
        {bestWeek && (
          <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
            <Star className="h-5 w-5 text-warning shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Best week: {bestWeek.weekName.replace(/.*—\s*/, "")}</p>
              <p className="text-xs text-muted-foreground">
                {bestWeek.totalPoints} pts
                {weeklyRankMap.has(bestWeek.weekId) ? ` · #${weeklyRankMap.get(bestWeek.weekId)}` : ""}
              </p>
            </div>
            <p className="text-2xl font-bold text-primary">{bestWeek.totalPoints}</p>
          </div>
        )}

        {/* Week list */}
        {weekSummaries.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <Trophy className="mx-auto h-8 w-8 mb-2 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No completed match weeks yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Your prediction history will appear here after matches are played.</p>
          </div>
        )}

        {reversedSummaries.map(hist => {
          const isExpanded = expandedWeek === hist.weekId;
          const summaryIdx = weekSummaries.indexOf(hist);
          const position = weeklyRankMap.get(hist.weekId);
          const totalPlayers = weeklyLeaderboardQueries[summaryIdx]?.data?.length ?? 0;
          const correct = hist.predictions.filter(p => p.pointsEarned > 0).length;
          const total = hist.predictions.length;

          const breakdown = {
            home_win: { earned: 0, count: 0 },
            away_win: { earned: 0, count: 0 },
            draw: { earned: 0, count: 0 },
            correct_score: { earned: 0, count: 0 },
          };
          hist.predictions.forEach(p => {
            if (p.pointsEarned > 0 && p.outcome in breakdown) {
              breakdown[p.outcome as keyof typeof breakdown].earned += p.pointsEarned;
              breakdown[p.outcome as keyof typeof breakdown].count++;
            }
          });

          return (
            <div key={hist.weekId} className="rounded-xl border border-border bg-card overflow-hidden transition-all duration-200">
              <button
                className="w-full p-4 flex items-center justify-between text-left hover:bg-secondary/30 transition-colors"
                onClick={() => setExpandedWeek(isExpanded ? null : hist.weekId)}
              >
                <div>
                  <p className="font-semibold text-sm">{hist.weekName.replace(/.*—\s*/, "")}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="w-16 h-1 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full bg-success rounded-full"
                        style={{ width: `${total > 0 ? (correct / total) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{correct}/{total}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {position !== undefined && (
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      position <= 3 ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
                    }`}>
                      <Trophy className="h-3 w-3 inline mr-0.5" />
                      #{position}{totalPlayers > 0 ? `/${totalPlayers}` : ""}
                    </span>
                  )}
                  <span className="text-lg font-bold">{hist.totalPoints}</span>
                  <span className="text-[10px] text-muted-foreground">pts</span>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-border px-4 pb-4 pt-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-4 gap-2">
                    {([
                      { key: "home_win", label: "Home Win", color: "border-blue-500 text-blue-400" },
                      { key: "draw", label: "Draw", color: "border-yellow-500 text-yellow-400" },
                      { key: "away_win", label: "Away Win", color: "border-purple-500 text-purple-400" },
                      { key: "correct_score", label: "Score", color: "border-primary text-primary" },
                    ] as const).map(cat => {
                      const data = breakdown[cat.key];
                      return (
                        <div key={cat.key} className={`rounded-lg border ${cat.color} bg-card p-2 text-center`}>
                          <p className="text-sm font-bold">+{data.earned}</p>
                          <p className="text-[9px] text-muted-foreground">{cat.label}</p>
                          <p className="text-[9px] text-muted-foreground">{data.count}</p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-1">
                    {hist.predictions.map(pred => {
                      const fixture = hist.week?.fixtures.find(f => f.id === pred.fixtureId);
                      if (!fixture) return null;
                      const won = pred.pointsEarned > 0;
                      return (
                        <div key={pred.fixtureId} className="flex items-center justify-between rounded-lg px-3 py-2 text-xs">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {won ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                            ) : (
                              <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="font-medium truncate">{fixture.homeTeam} vs {fixture.awayTeam}</p>
                              <p className="text-muted-foreground">
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium mr-1 ${
                                  pred.outcome === "home_win" ? "bg-blue-500/20 text-blue-400" :
                                  pred.outcome === "away_win" ? "bg-purple-500/20 text-purple-400" :
                                  pred.outcome === "draw" ? "bg-yellow-500/20 text-yellow-400" :
                                  "bg-primary/20 text-primary"
                                }`}>
                                  {pred.outcome.replace("_", " ")}
                                  {pred.outcome === "correct_score" && pred.homeGoals != null
                                    ? ` ${pred.homeGoals}-${pred.awayGoals}`
                                    : ""}
                                </span>
                                {fixture.finalScore
                                  ? `· FT ${fixture.finalScore.home}-${fixture.finalScore.away}`
                                  : ""}
                              </p>
                            </div>
                          </div>
                          <span className={`font-semibold ml-2 ${won ? "text-primary" : "text-muted-foreground"}`}>
                            {won ? `+${pred.pointsEarned}` : "0"}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
                    <span className="text-muted-foreground">
                      ⊙ {correct} correct · {total > 0 ? Math.round((correct / total) * 100) : 0}% accuracy
                    </span>
                    <span className="font-bold text-primary">+{hist.totalPoints} pts</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Dashboard;
