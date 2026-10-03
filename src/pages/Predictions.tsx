import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/context/AppContext";
import { api, type FixtureDto, type OutcomeType, type PredictionItem } from "@/lib/api";
import { POINTS } from "@/lib/constants";
import { toast } from "sonner";
import { format } from "date-fns";
import { Lock, Clock, Loader2 } from "lucide-react";
import NavBar from "@/components/NavBar";

type Pick = { outcome: OutcomeType; homeGoals?: number; awayGoals?: number };

const outcomeOptions: { value: OutcomeType; label: string; pts: number; color: string }[] = [
  { value: "home_win", label: "Home Win", pts: POINTS.home_win, color: "border-blue-500 text-blue-400" },
  { value: "draw", label: "Draw", pts: POINTS.draw, color: "border-yellow-500 text-yellow-400" },
  { value: "away_win", label: "Away Win", pts: POINTS.away_win, color: "border-purple-500 text-purple-400" },
  { value: "correct_score", label: "Score", pts: POINTS.correct_score, color: "border-primary text-primary" },
];

function isWeekLocked(fixtures: FixtureDto[]): boolean {
  const preMatch = fixtures.filter((f) => f.status === "pre_match");
  if (preMatch.length === 0) return true;
  const earliest = preMatch.reduce((a, b) =>
    new Date(a.kickoff) < new Date(b.kickoff) ? a : b
  );
  return new Date() >= new Date(new Date(earliest.kickoff).getTime() - 30_000);
}

function getLockTime(fixtures: FixtureDto[]): Date | null {
  const preMatch = fixtures.filter((f) => f.status === "pre_match");
  if (preMatch.length === 0) return null;
  const earliest = preMatch.reduce((a, b) =>
    new Date(a.kickoff) < new Date(b.kickoff) ? a : b
  );
  return new Date(new Date(earliest.kickoff).getTime() - 30_000);
}

const CountdownTimer = ({ lockTime }: { lockTime: Date }) => {
  const [timeLeft, setTimeLeft] = useState(() => Math.max(0, lockTime.getTime() - Date.now()));

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, lockTime.getTime() - Date.now());
      setTimeLeft(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [lockTime]);

  const mins = Math.floor(timeLeft / 60_000);
  const secs = Math.floor((timeLeft % 60_000) / 1000);
  const pad = (n: number) => n.toString().padStart(2, "0");

  if (timeLeft <= 0) return null;
  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border">
      <Lock className="h-4 w-4 text-primary" />
      <span className="text-sm text-muted-foreground">Locks in</span>
      <span className="font-mono font-bold text-primary text-lg">{pad(mins)}:{pad(secs)}</span>
    </div>
  );
};

const Predictions = () => {
  const { currentUser } = useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedWeekId, setSelectedWeekId] = useState<string>("");
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [weekLocked, setWeekLocked] = useState(false);

  const { data: lockStatus } = useQuery({
    queryKey: ["predictions-lock-status"],
    queryFn: api.predictions.lockStatus,
    refetchInterval: 10_000,
    enabled: !!currentUser,
  });

  const { data: weeks, isLoading: weeksLoading, error: weeksError } = useQuery({
    queryKey: ["weeks"],
    queryFn: api.weeks.list,
    enabled: !!currentUser,
  });

  const { data: existingPreds } = useQuery({
    queryKey: ["predictions", selectedWeekId],
    queryFn: () => api.predictions.mine(selectedWeekId),
    enabled: !!selectedWeekId && !!currentUser,
  });

  const { mutate: submitMutation, isPending: isSubmitting } = useMutation({
    mutationFn: ({ weekId, predictions }: { weekId: string; predictions: PredictionItem[] }) =>
      api.predictions.submit(weekId, predictions),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["predictions", vars.weekId] });
      toast.success(hasSubmitted ? "Predictions updated!" : "Predictions submitted!");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to submit predictions.");
    },
  });

  const selectedWeek = weeks?.find((w) => w.id === selectedWeekId) ?? weeks?.[0];

  // Set default selected week once data loads
  useEffect(() => {
    if (!weeks?.length || selectedWeekId) return;
    const active = weeks.find((w) => w.fixtures.some((f) => f.status === "pre_match"));
    setSelectedWeekId(active?.id ?? weeks[weeks.length - 1].id);
  }, [weeks, selectedWeekId]);

  // Sync picks from server predictions when week changes
  useEffect(() => {
    if (!existingPreds) return;
    const map: Record<string, Pick> = {};
    existingPreds.forEach((p) => {
      map[p.fixtureId] = {
        outcome: p.outcome,
        homeGoals: p.homeGoals ?? undefined,
        awayGoals: p.awayGoals ?? undefined,
      };
    });
    setPicks(map);
  }, [existingPreds, selectedWeekId]);

  // Poll lock state every second
  useEffect(() => {
    if (!selectedWeek) return;
    const interval = setInterval(() => setWeekLocked(isWeekLocked(selectedWeek.fixtures)), 1000);
    setWeekLocked(isWeekLocked(selectedWeek?.fixtures ?? []));
    return () => clearInterval(interval);
  }, [selectedWeekId, weeks]);

  if (!currentUser) {
    navigate("/");
    return null;
  }

  if (currentUser.role === "admin") {
    navigate("/admin");
    return null;
  }

  if (weeksLoading) {
    return (
      <div className="min-h-screen bg-background">
        <NavBar />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (weeksError) {
    return (
      <div className="min-h-screen bg-background">
        <NavBar />
        <div className="mx-auto max-w-2xl px-4 pt-12">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
            <p className="text-sm text-destructive font-medium">Failed to load weeks</p>
            <p className="text-xs text-destructive/80 mt-1">
              {weeksError instanceof Error ? weeksError.message : "Unknown error"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!weeks?.length) {
    return (
      <div className="min-h-screen bg-background">
        <NavBar />
        <div className="mx-auto max-w-2xl px-4 pt-12 text-center">
          <p className="text-muted-foreground">No fixtures available yet. Check back soon.</p>
        </div>
      </div>
    );
  }

  if (!selectedWeek) return null;

  const globalLocked = !!lockStatus?.locked;
  const locked = weekLocked || globalLocked;
  const hasSubmitted = !!existingPreds?.length;
  const lockTime = getLockTime(selectedWeek.fixtures);
  const sortedFixtures = [...selectedWeek.fixtures].sort(
    (a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()
  );

  const editableCount = sortedFixtures.filter((f) => f.status === "pre_match").length;
  const weekEnded = sortedFixtures.length > 0 && sortedFixtures.every((f) => f.status !== "pre_match" && f.status !== "live");
  const predictedCount = Object.keys(picks).length;
  const potentialPts = Object.values(picks).reduce((sum, p) => sum + POINTS[p.outcome], 0);

  // Group by day
  const now = new Date();
  const groupedByDay: { label: string; fixtures: FixtureDto[] }[] = [];
  sortedFixtures.forEach((f) => {
    const d = new Date(f.kickoff);
    const isToday = d.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();
    const label = isToday ? "TODAY" : isTomorrow ? "TOMORROW" : format(d, "EEEE, MMMM d").toUpperCase();
    const existing = groupedByDay.find((g) => g.label === label);
    if (existing) existing.fixtures.push(f);
    else groupedByDay.push({ label, fixtures: [f] });
  });

  const updatePick = (fixtureId: string, outcome: OutcomeType) => {
    setPicks((prev) => ({
      ...prev,
      [fixtureId]: { outcome, homeGoals: prev[fixtureId]?.homeGoals, awayGoals: prev[fixtureId]?.awayGoals },
    }));
  };

  const updateScore = (fixtureId: string, field: "homeGoals" | "awayGoals", val: string) => {
    const num = val === "" ? undefined : Math.max(0, parseInt(val) || 0);
    setPicks((prev) => ({
      ...prev,
      [fixtureId]: { ...prev[fixtureId], outcome: "correct_score", [field]: num },
    }));
  };

  const switchWeek = (weekId: string) => {
    setSelectedWeekId(weekId);
    setPicks({});
  };

  const handleSubmit = () => {
    const editable = sortedFixtures.filter((f) => f.status === "pre_match");
    const missing = editable.filter((f) => !picks[f.id]);
    if (missing.length > 0) {
      toast.error(`You still have ${missing.length} match${missing.length > 1 ? "es" : ""} to predict.`);
      return;
    }
    for (const f of editable) {
      const p = picks[f.id];
      if (p?.outcome === "correct_score" && (p.homeGoals === undefined || p.awayGoals === undefined)) {
        toast.error(`Enter the score for ${f.homeTeam} vs ${f.awayTeam}.`);
        return;
      }
    }
    const predictions: PredictionItem[] = editable
      .filter((f) => picks[f.id])
      .map((f) => ({ fixtureId: f.id, ...picks[f.id] }));
    submitMutation({ weekId: selectedWeekId, predictions });
  };

  return (
    <div className="min-h-screen bg-background pb-8 page-transition">
      <NavBar />

      <div className="mx-auto max-w-2xl px-4 pt-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {selectedWeek.name.replace(`${selectedWeek.competition} — `, "")} · {selectedWeek.competition}
            </h1>
            <p className="text-sm text-muted-foreground">
              {predictedCount}/{editableCount} predicted · +{potentialPts} pts potential
            </p>
          </div>
          {!locked && lockTime && <CountdownTimer lockTime={lockTime} />}
        </div>

        {/* Week selector */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {weeks.map((w) => {
            const wLocked = isWeekLocked(w.fixtures);
            return (
              <button
                key={w.id}
                onClick={() => switchWeek(w.id)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                  w.id === selectedWeekId
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {w.name.replace(`${w.competition} — `, "")}
                {wLocked && " 🔒"}
              </button>
            );
          })}
        </div>

        {/* Saved banner */}
        {hasSubmitted && !locked && (
          <div className="flex items-center gap-2 rounded-lg bg-success/10 border border-success/30 px-4 py-2.5 text-sm text-success fade-in-up">
            <span>✓</span>
            <span>Predictions saved! You can still edit until lock time.</span>
          </div>
        )}

        {/* Lock status */}
        {locked && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-2.5 text-sm text-destructive fade-in-up">
            <Lock className="h-4 w-4" />
            <span>
              {globalLocked
                ? "Predictions are currently locked by an admin"
                : `Predictions locked — ${weekEnded ? "matches have ended" : "matches have started"}`}
            </span>
          </div>
        )}

        {/* Match cards grouped by day */}
        {groupedByDay.map((group, gi) => (
          <div key={group.label} className="fade-in-up" style={{ animationDelay: `${gi * 60}ms` }}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-semibold text-muted-foreground tracking-wider">{group.label}</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="space-y-3">
              {group.fixtures.map((fixture, mi) => {
                const pick = picks[fixture.id];
                const matchLocked = fixture.status !== "pre_match";
                const score = fixture.liveScore ?? fixture.finalScore;

                return (
                  <div
                    key={fixture.id}
                    className={`rounded-xl border border-border bg-card p-4 space-y-3 transition-all duration-300 ${matchLocked ? "opacity-50" : ""}`}
                    style={{ animationDelay: `${(gi * 3 + mi) * 40}ms` }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(fixture.kickoff), "EEE, MMM d")} · {format(new Date(fixture.kickoff), "HH:mm")}
                      </span>
                      {pick && !matchLocked && !locked && (
                        <span className="text-xs text-primary font-medium">+{POINTS[pick.outcome]}pts potential</span>
                      )}
                      {pick && (matchLocked || locked) && (
                        <span className="text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {pick.outcome.replace("_", " ")}
                          {pick.outcome === "correct_score" && ` (${pick.homeGoals}-${pick.awayGoals})`}
                        </span>
                      )}
                    </div>

                    {/* Teams */}
                    <div className="flex items-center justify-center gap-4">
                      <div className="flex-1 text-right">
                        <span className="font-semibold text-sm">{fixture.homeTeam}</span>
                        <p className="text-[10px] text-muted-foreground">{fixture.homeTeam.substring(0, 3).toUpperCase()}</p>
                      </div>
                      {score ? (
                        <span
                          className={`font-bold text-sm px-3 py-1 rounded ${
                            fixture.status === "live" ? "bg-success/20 text-success" : "bg-secondary"
                          }`}
                        >
                          {score.home} – {score.away}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground px-3 py-1 rounded bg-secondary">vs</span>
                      )}
                      <div className="flex-1">
                        <span className="font-semibold text-sm">{fixture.awayTeam}</span>
                        <p className="text-[10px] text-muted-foreground">{fixture.awayTeam.substring(0, 3).toUpperCase()}</p>
                      </div>
                    </div>

                    {/* Prediction buttons */}
                    {!matchLocked && !locked && (
                      <>
                        <div className="grid grid-cols-4 gap-2">
                          {outcomeOptions.map((opt) => {
                            const selected = pick?.outcome === opt.value;
                            return (
                              <button
                                key={opt.value}
                                onClick={() => updatePick(fixture.id, opt.value)}
                                className={`flex flex-col items-center gap-0.5 py-2.5 rounded-lg border text-xs font-medium transition-all duration-200 ${
                                  selected
                                    ? `${opt.color} border-current bg-current/10`
                                    : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                                }`}
                              >
                                <span>{opt.label}</span>
                                <span className="text-[10px] opacity-70">+{opt.pts}pts</span>
                              </button>
                            );
                          })}
                        </div>

                        {pick?.outcome === "correct_score" && (
                          <div className="flex items-center gap-2 justify-center fade-in-up">
                            <span className="text-xs text-muted-foreground">{fixture.homeTeam}</span>
                            <Input
                              type="number"
                              min={0}
                              className="w-14 h-8 text-center text-sm bg-secondary border-border"
                              placeholder="0"
                              value={pick.homeGoals ?? ""}
                              onChange={(e) => updateScore(fixture.id, "homeGoals", e.target.value)}
                            />
                            <span className="text-muted-foreground">-</span>
                            <Input
                              type="number"
                              min={0}
                              className="w-14 h-8 text-center text-sm bg-secondary border-border"
                              placeholder="0"
                              value={pick.awayGoals ?? ""}
                              onChange={(e) => updateScore(fixture.id, "awayGoals", e.target.value)}
                            />
                            <span className="text-xs text-muted-foreground">{fixture.awayTeam}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {!locked && editableCount > 0 && (
          <div className="pt-2 pb-6 fade-in-up">
            <Button
              className="w-full h-12 text-base rounded-xl"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {hasSubmitted ? "Update Predictions" : "Submit All Predictions"} ({predictedCount}/{editableCount})
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Predictions;
