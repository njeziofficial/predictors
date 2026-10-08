import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { hasMatchesInPlay, useLivePollInterval } from "@/lib/liveData";
import type { PredictionDto } from "@/lib/api";
import { Clock } from "lucide-react";
import NavBar from "@/components/NavBar";
import { BrandLoader } from "@/components/Brand";

function predLabel(pred: PredictionDto): string {
  if (pred.outcome === "correct_score") {
    return `Correct Score (${pred.homeGoals}-${pred.awayGoals})`;
  }
  return pred.outcome.split("_").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
}

const MatchStatus = () => {
  const { currentUser } = useApp();
  const navigate = useNavigate();

  // Scores arrive as server pushes; polling is only the fallback (see useLivePollInterval).
  const pollEvery = useLivePollInterval();

  const { data: weeks = [] } = useQuery({
    queryKey: ["weeks"],
    queryFn: api.weeks.list,
    refetchInterval: (query) => pollEvery(hasMatchesInPlay(query.state.data)),
    enabled: !!currentUser,
  });

  const { data: preds = [] } = useQuery({
    queryKey: ["predictions", "all"],
    queryFn: () => api.predictions.mine(),
    enabled: !!currentUser,
    refetchInterval: pollEvery(hasMatchesInPlay(weeks)),
  });

  useEffect(() => {
    if (!currentUser) navigate("/");
  }, [currentUser, navigate]);

  if (!currentUser) return null;

  if (!weeks.length) {
    return (
      <div className="min-h-screen bg-background">
        <NavBar />
        <BrandLoader className="h-64" label="Loading match status…" />
      </div>
    );
  }

  const allFixtures = weeks.flatMap(w => w.fixtures);
  const liveFixtures = allFixtures
    .filter(f => f.status === "live")
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
  const predMap = new Map(preds.map(p => [p.fixtureId, p]));

  const endedCount = allFixtures.filter(f => f.status === "ended").length;
  const liveCount = liveFixtures.length;
  const totalPts = preds.reduce((s, p) => s + p.pointsEarned, 0);
  const correctCount = preds.filter(p => p.pointsEarned > 0).length;

  return (
    <div className="min-h-screen bg-background pb-8 page-transition">
      <NavBar />

      <div className="mx-auto max-w-2xl px-4 pt-6 space-y-6">
        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-2 fade-in-up">
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-lg font-bold">{endedCount}</p>
            <p className="text-[10px] text-muted-foreground">Ended</p>
          </div>
          <div className="rounded-lg border border-success/50 bg-success/10 p-3 text-center">
            <p className="text-lg font-bold text-success">{liveCount}</p>
            <p className="text-[10px] text-muted-foreground">Live</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-lg font-bold">{correctCount}/{endedCount}</p>
            <p className="text-[10px] text-muted-foreground">Correct</p>
          </div>
          <div className="rounded-lg border border-primary/50 bg-primary/10 p-3 text-center">
            <p className="text-lg font-bold text-primary">+{totalPts}</p>
            <p className="text-[10px] text-muted-foreground">Pts so far</p>
          </div>
        </div>

        {/* Live matches */}
        {liveFixtures.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center fade-in-up">
            <p className="text-muted-foreground text-sm">No live matches right now.</p>
          </div>
        ) : (
          <div className="space-y-3 fade-in-up">
            {liveFixtures.map(fixture => {
              const pred = predMap.get(fixture.id);
              const score = fixture.liveScore ?? fixture.finalScore;

              return (
                <div
                  key={fixture.id}
                  className="rounded-xl border border-success/50 bg-card p-4 space-y-3 shadow-[0_0_15px_rgba(34,197,94,0.12)] transition-all duration-500"
                >
                  {fixture.liveMinute != null && (
                    <div className="w-full h-0.5 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-success rounded-full transition-all duration-1000"
                        style={{ width: `${Math.min((fixture.liveMinute / 90) * 100, 100)}%` }}
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-success text-success-foreground animate-pulse">● LIVE</span>
                      {fixture.liveMinute != null && (
                        <span className="text-xs text-muted-foreground">{fixture.liveMinute}'</span>
                      )}
                    </div>
                    {pred ? (
                      <span className="text-xs flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {predLabel(pred)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">No prediction</span>
                    )}
                  </div>

                  <div className="flex items-center justify-center gap-4">
                    <span className="font-semibold text-sm flex-1 text-right">{fixture.homeTeam}</span>
                    {score ? (
                      <span className="font-bold text-xl px-3 text-success transition-colors duration-300">
                        {score.home} – {score.away}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground px-3">vs</span>
                    )}
                    <span className="font-semibold text-sm flex-1">{fixture.awayTeam}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchStatus;
