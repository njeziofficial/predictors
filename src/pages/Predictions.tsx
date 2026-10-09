import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/context/AppContext";
import { api, type FixtureDto, type OutcomeType, type PredictionItem } from "@/lib/api";
import { POINTS } from "@/lib/constants";
import { useLivePollInterval } from "@/lib/liveData";
import { toast } from "sonner";
import { format } from "date-fns";
import { Lock, Clock, Loader2, AlertTriangle, Info } from "lucide-react";
import { BrandLoader } from "@/components/Brand";
import NavBar from "@/components/NavBar";
import { LatestChampions } from "@/components/WeeklyChampions";
import MyStanding from "@/components/MyStanding";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { DEFAULT_PREDICTION_RULES, isFixtureOpen, weekPredictionState } from "@/lib/predictionRules";

type Pick = { outcome: OutcomeType; homeGoals?: number; awayGoals?: number };

const outcomeOptions: { value: OutcomeType; label: string; pts: number; color: string }[] = [
  { value: "home_win", label: "Home Win", pts: POINTS.home_win, color: "border-blue-500 text-blue-400" },
  { value: "draw", label: "Draw", pts: POINTS.draw, color: "border-yellow-500 text-yellow-400" },
  { value: "away_win", label: "Away Win", pts: POINTS.away_win, color: "border-purple-500 text-purple-400" },
  { value: "correct_score", label: "Score", pts: POINTS.correct_score, color: "border-primary text-primary" },
];

const pickLabel = (pick: Pick) =>
  pick.outcome === "correct_score"
    ? `Score ${pick.homeGoals}-${pick.awayGoals}`
    : outcomeOptions.find((o) => o.value === pick.outcome)?.label ?? pick.outcome;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : word.endsWith("ch") ? "es" : "s"}`;

const CountdownTimer = ({ lockTime, label }: { lockTime: Date; label: string }) => {
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
      <span className="text-sm text-muted-foreground">{label}</span>
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
  const [now, setNow] = useState(() => new Date());
  // The submission waiting on the warning prompt (final and/or incomplete predictions).
  const [pendingSubmit, setPendingSubmit] = useState<PredictionItem[] | null>(null);

  // An admin locking predictions or changing the rules is pushed as a "settings" change; polling is only the fallback.
  // (Submitting is refused server-side while locked either way.)
  const pollEvery = useLivePollInterval();
  const { data: lockStatus } = useQuery({
    queryKey: ["predictions-lock-status"],
    queryFn: api.predictions.lockStatus,
    refetchInterval: pollEvery(false),
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
      // Every cached list of my predictions (this week's, and the all-weeks one History and Live use).
      queryClient.invalidateQueries({ queryKey: ["predictions"] });
      toast.success(hasSubmitted && !rules.predictionsFinal ? "Predictions updated!" : "Predictions submitted!");
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

  // Re-check kickoff locks every second.
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!currentUser) {
    navigate("/");
    return null;
  }

  if (weeksLoading) {
    return (
      <div className="min-h-screen bg-background">
        <NavBar />
        <BrandLoader className="h-64" />
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

  const rules = lockStatus?.rules ?? DEFAULT_PREDICTION_RULES;
  const globalLocked = !!lockStatus?.locked;
  const savedIds = new Set((existingPreds ?? []).map((p) => p.fixtureId));
  const hasSubmitted = savedIds.size > 0;
  const weekState = weekPredictionState(selectedWeek.fixtures, savedIds, rules, globalLocked, now);
  const locked = weekState.lockReason !== null;
  const sortedFixtures = [...selectedWeek.fixtures].sort(
    (a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()
  );

  const openFixtures = weekState.openFixtures;
  const openCount = openFixtures.length;
  const weekEnded = sortedFixtures.length > 0 && sortedFixtures.every((f) => f.status !== "pre_match" && f.status !== "live");
  const predictedCount = openFixtures.filter((f) => picks[f.id]).length;
  const missingFixtures = openFixtures.filter((f) => !picks[f.id]);
  const potentialPts = Object.values(picks).reduce((sum, p) => sum + POINTS[p.outcome], 0);
  // Skipped matches can be filled in later unless this submission is the player's one late entry,
  // or the whole week locks at its first kickoff and that has already happened.
  const canAddSkippedLater = !weekState.lateEntry;

  // Group by day
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
    if (!rules.allowPartialPredictions && missingFixtures.length > 0) {
      toast.error(`You still have ${plural(missingFixtures.length, "match")} to predict. Every match must be predicted.`);
      return;
    }
    // Only matches this player may still change: under "final" rules, saved ones are left out.
    const editable = openFixtures.filter((f) => weekState.editableIds.has(f.id) && picks[f.id]);
    for (const f of editable) {
      const p = picks[f.id];
      if (p.outcome === "correct_score" && (p.homeGoals === undefined || p.awayGoals === undefined)) {
        toast.error(`Enter the score for ${f.homeTeam} vs ${f.awayTeam}.`);
        return;
      }
    }
    if (editable.length === 0) {
      toast.error("Pick at least one match to predict.");
      return;
    }
    const predictions: PredictionItem[] = editable.map((f) => ({ fixtureId: f.id, ...picks[f.id] }));
    // Final or incomplete predictions need the player to confirm they understand.
    if (rules.predictionsFinal || missingFixtures.length > 0) setPendingSubmit(predictions);
    else submitMutation({ weekId: selectedWeekId, predictions });
  };

  const confirmSubmit = () => {
    if (pendingSubmit) submitMutation({ weekId: selectedWeekId, predictions: pendingSubmit });
    setPendingSubmit(null);
  };

  return (
    <div className="min-h-screen bg-background pb-8 page-transition">
      <NavBar />

      <div className="mx-auto max-w-2xl px-4 pt-6 space-y-6">
        <MyStanding userId={currentUser.id} />
        <LatestChampions weeks={weeks} currentUserId={currentUser.id} />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {selectedWeek.name.replace(`${selectedWeek.competition} — `, "")} · {selectedWeek.competition}
            </h1>
            <p className="text-sm text-muted-foreground">
              {predictedCount}/{openCount} predicted · +{potentialPts} pts potential
            </p>
          </div>
          {weekState.nextLockAt && (
            <CountdownTimer
              lockTime={weekState.nextLockAt}
              label={weekState.nextLockIsWeek ? "Week locks in" : "Next match locks in"}
            />
          )}
        </div>

        {/* The rules in force, so nobody is surprised by them */}
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          <span className="px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
            {rules.allowPartialPredictions ? "You may skip matches" : "Every match must be predicted"}
          </span>
          {rules.predictionsFinal && (
            <span className="px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">Predictions are final once submitted</span>
          )}
          <span className="px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
            {rules.lockWeekAtFirstKickoff ? "Week locks at first kickoff" : "Each match locks at its kickoff"}
          </span>
          {rules.lockWeekAtFirstKickoff && rules.allowLatePredictions && (
            <span className="px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">Late predictions allowed</span>
          )}
        </div>

        {/* Week selector */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {weeks.map((w) => {
            const wLocked =
              w.id === selectedWeek.id
                ? locked
                : weekPredictionState(w.fixtures, new Set(), rules, globalLocked, now).lockReason !== null;
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
            <span>
              {rules.predictionsFinal
                ? `Predictions saved. They're final and can't be changed.${
                    rules.allowPartialPredictions && weekState.editableIds.size > 0
                      ? " You can still predict the matches you skipped."
                      : ""
                  }`
                : "Predictions saved! You can still edit until lock time."}
            </span>
          </div>
        )}

        {/* Late entry: the week has locked for everyone who predicted, but not for this player */}
        {weekState.lateEntry && !locked && (
          <div className="flex items-start gap-2 rounded-lg bg-primary/10 border border-primary/30 px-4 py-2.5 text-sm text-primary fade-in-up">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              This week has already kicked off. You hadn't predicted yet, so you can still predict the matches that
              haven't started. You get one submission: after it, the week is locked for you.
            </span>
          </div>
        )}

        {/* Lock status */}
        {locked && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-2.5 text-sm text-destructive fade-in-up">
            <Lock className="h-4 w-4" />
            <span>
              {weekState.lockReason === "admin"
                ? "Predictions are currently locked by an admin"
                : weekState.lockReason === "week_started"
                  ? "Predictions for this week locked when its first match kicked off"
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
                const matchLocked = !isFixtureOpen(fixture, now);
                const editable = weekState.editableIds.has(fixture.id);
                const savedFinal = rules.predictionsFinal && savedIds.has(fixture.id);
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
                      {pick && editable && (
                        <span className="text-xs text-primary font-medium">+{POINTS[pick.outcome]}pts potential</span>
                      )}
                      {pick && !editable && (
                        <span className="text-xs text-muted-foreground">
                          {savedFinal && !matchLocked ? (
                            <Lock className="h-3 w-3 inline mr-1" />
                          ) : (
                            <Clock className="h-3 w-3 inline mr-1" />
                          )}
                          {pick.outcome.replace("_", " ")}
                          {pick.outcome === "correct_score" && ` (${pick.homeGoals}-${pick.awayGoals})`}
                          {savedFinal && !matchLocked && " · final"}
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
                    {editable && (
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

        {weekState.editableIds.size > 0 && (
          <div className="pt-2 pb-6 fade-in-up">
            <Button
              className="w-full h-12 text-base rounded-xl"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {hasSubmitted && !rules.predictionsFinal
                ? "Update Predictions"
                : rules.allowPartialPredictions
                  ? "Submit Predictions"
                  : "Submit All Predictions"}{" "}
              ({predictedCount}/{openCount})
            </Button>
          </div>
        )}
      </div>

      {/* Warning before final and/or incomplete predictions go in */}
      <AlertDialog open={pendingSubmit !== null} onOpenChange={(open) => !open && setPendingSubmit(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              {rules.predictionsFinal && missingFixtures.length > 0
                ? "Submit incomplete, final predictions?"
                : rules.predictionsFinal
                  ? "Submit final predictions?"
                  : "Submit incomplete predictions?"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                {missingFixtures.length > 0 && (
                  <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-yellow-600 dark:text-yellow-400">
                    <p className="font-semibold">Your predictions are incomplete.</p>
                    <p>
                      You've predicted {predictedCount} of {openCount} matches. {plural(missingFixtures.length, "match")}{" "}
                      {missingFixtures.length === 1 ? "has" : "have"} no prediction and will score no points:
                    </p>
                    <ul className="mt-1 list-disc pl-5">
                      {missingFixtures.map((f) => (
                        <li key={f.id}>
                          {f.homeTeam} vs {f.awayTeam}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1">
                      {canAddSkippedLater
                        ? rules.lockWeekAtFirstKickoff
                          ? "You can still predict them later, but only until the week's first match kicks off."
                          : "You can still predict them later, until each one kicks off."
                        : "You won't be able to predict them later: this is your only submission for this week."}
                    </p>
                  </div>
                )}
                {rules.predictionsFinal && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive">
                    <p className="font-semibold">These predictions can never be changed.</p>
                    <p>Once you submit, your picks below are final. Nobody can edit or undo them, including you.</p>
                  </div>
                )}
                {pendingSubmit && (
                  <ul className="space-y-1">
                    {pendingSubmit.map((p) => {
                      const f = openFixtures.find((x) => x.id === p.fixtureId);
                      return (
                        <li key={p.fixtureId} className="flex justify-between gap-3">
                          <span className="truncate">
                            {f?.homeTeam} vs {f?.awayTeam}
                          </span>
                          <span className="shrink-0 font-medium text-foreground">{pickLabel(p)}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSubmit}>
              {rules.predictionsFinal ? "I understand, submit" : "Submit anyway"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Predictions;
