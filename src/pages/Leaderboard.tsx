import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { format } from "date-fns";
import { Trophy, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import NavBar from "@/components/NavBar";

const Leaderboard = () => {
  const { currentUser } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"overall" | "weekly">("weekly");
  const [weekIdx, setWeekIdx] = useState(0);

  const { data: weeks = [] } = useQuery({
    queryKey: ["weeks"],
    queryFn: api.weeks.list,
    enabled: !!currentUser,
  });

  const activeWeeks = weeks.filter(w =>
    w.fixtures.some(f => f.status !== "pre_match")
  );
  const currentWeekData = activeWeeks[weekIdx];

  const { data: overallData = [] } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: api.leaderboard.overall,
    enabled: !!currentUser,
  });

  const { data: weeklyData = [] } = useQuery({
    queryKey: ["leaderboard-week", currentWeekData?.id],
    queryFn: () => api.leaderboard.byWeek(currentWeekData!.id),
    enabled: !!currentUser && !!currentWeekData?.id,
  });

  useEffect(() => {
    if (!currentUser) navigate("/");
  }, [currentUser, navigate]);

  if (!currentUser) return null;

  const isLive = currentWeekData?.fixtures.some(f => f.status === "live");
  const displayData = tab === "overall" ? overallData : weeklyData;
  const top3 = displayData.slice(0, 3);
  const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
  const podiumHeights = ["h-20", "h-28", "h-16"];
  const podiumColors = ["bg-secondary", "bg-primary/20", "bg-secondary"];
  const podiumBorders = ["border-secondary", "border-primary", "border-secondary"];
  const trophyColors = ["text-gray-400", "text-primary", "text-amber-700"];

  return (
    <div className="min-h-screen bg-background pb-8 page-transition">
      <NavBar />

      <div className="mx-auto max-w-2xl px-4 pt-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Standings</h1>
          <p className="text-sm text-muted-foreground">Points tiebreak: earliest submission wins</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-secondary rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab("weekly")}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === "weekly" ? "bg-background text-foreground" : "text-muted-foreground"
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => setTab("overall")}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === "overall" ? "bg-background text-foreground" : "text-muted-foreground"
            }`}
          >
            Overall
          </button>
        </div>

        {/* Week navigator */}
        {tab === "weekly" && activeWeeks.length > 0 && (
          <div className="flex items-center justify-between">
            <button
              onClick={() => setWeekIdx(i => Math.max(0, i - 1))}
              disabled={weekIdx === 0}
              className="p-1.5 rounded bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="text-center">
              <p className="text-sm font-semibold">
                {currentWeekData?.name} {isLive ? "(live)" : "(ended)"}
              </p>
              <p className={`text-xs ${isLive ? "text-primary" : "text-success"}`}>
                {isLive ? "In progress — updating after each match" : "Results final"}
              </p>
            </div>
            <button
              onClick={() => setWeekIdx(i => Math.min(activeWeeks.length - 1, i + 1))}
              disabled={weekIdx >= activeWeeks.length - 1}
              className="p-1.5 rounded bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}

        {tab === "weekly" && activeWeeks.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <Trophy className="mx-auto h-8 w-8 mb-2 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground text-sm">No match weeks in progress yet.</p>
          </div>
        )}

        {/* Podium */}
        {top3.length >= 3 && (
          <div className="flex items-end justify-center gap-3 pt-4">
            {podiumOrder.map((entry, i) => {
              const isMe = entry.userId === currentUser.id;
              return (
                <div key={entry.userId} className="flex flex-col items-center gap-2 w-24">
                  <p className="text-xs text-muted-foreground truncate max-w-full">
                    {isMe ? "You" : entry.name.split(" ")[0]}
                  </p>
                  <p className="text-xs font-semibold">{entry.totalPoints} pts</p>
                  <div
                    className={`w-full ${podiumHeights[i]} ${podiumColors[i]} rounded-t-lg border ${podiumBorders[i]} flex items-center justify-center transition-all duration-300`}
                  >
                    <Trophy className={`h-5 w-5 ${trophyColors[i]}`} />
                  </div>
                  <span className="text-xs font-bold text-muted-foreground">#{entry.position}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Leaderboard rows */}
        <div className="space-y-1">
          {displayData.map(entry => {
            const isMe = entry.userId === currentUser.id;
            return (
              <div
                key={entry.userId}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isMe ? "bg-primary/10 border border-primary/30" : "bg-card border border-transparent"
                }`}
              >
                <span className="text-sm font-bold text-muted-foreground w-6 shrink-0">
                  #{entry.position}
                </span>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {isMe ? "You" : entry.name}
                      {isMe && <span className="ml-1 text-xs text-primary">(you)</span>}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>
                        {entry.lastSubmittedAt
                          ? format(new Date(entry.lastSubmittedAt), "HH:mm")
                          : "--:--"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${isMe ? "text-primary" : ""}`}>{entry.totalPoints}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {entry.previousPoints > 0 ? `pts · incl. ${entry.previousPoints} previous` : "pts"}
                  </p>
                </div>
              </div>
            );
          })}
          {displayData.length === 0 && tab === "overall" && (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <Trophy className="mx-auto h-8 w-8 mb-2 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground text-sm">No predictions submitted yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
