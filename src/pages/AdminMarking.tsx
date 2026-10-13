import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ChevronDown, CircleAlert, CircleCheck, Clock, EyeOff, Search, ShieldCheck } from "lucide-react";
import { BrandLoader } from "@/components/Brand";
import AdminLayout from "@/components/AdminLayout";
import CompetitionSwitcher from "@/components/CompetitionSwitcher";
import { useCompetition } from "@/context/CompetitionContext";
import { api, type MarkedPickDto, type MarkingFixtureDto, type PlayerMarkingDto } from "@/lib/api";
import { activeWeek, sortWeeks } from "@/lib/weeks";
import { OUTCOME_STYLES, outcomeLabel } from "@/lib/outcomeStyles";
import { POINTS } from "@/lib/constants";
import { useApp } from "@/context/AppContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const displayName = (p: PlayerMarkingDto) => p.whatsAppName || p.name;

const resultText = (f: MarkingFixtureDto) =>
  f.status === "ended" && f.finalScoreHome != null && f.finalScoreAway != null
    ? `${f.finalScoreHome}-${f.finalScoreAway}`
    : f.status === "live"
      ? "In play"
      : f.status === "postponed"
        ? "Postponed"
        : f.status === "cancelled"
          ? "Cancelled"
          : format(new Date(f.kickoff), "EEE HH:mm");

const PickBadge = ({ pick }: { pick: MarkedPickDto }) => {
  if (!pick.outcome)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <EyeOff className="h-3 w-3" /> Hidden
      </span>
    );
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${OUTCOME_STYLES[pick.outcome].badge}`}>
      {outcomeLabel(pick.outcome, pick.homeGoals, pick.awayGoals)}
    </span>
  );
};

const PlayerPicks = ({ player, fixtures }: { player: PlayerMarkingDto; fixtures: MarkingFixtureDto[] }) => {
  const byFixture = new Map(player.picks.map((p) => [p.fixtureId, p]));
  return (
    <div className="divide-y divide-border border-t border-border bg-background/40">
      {fixtures.map((f) => {
        const pick = byFixture.get(f.id);
        const mismatch = pick && pick.points !== pick.expectedPoints;
        return (
          <div
            key={f.id}
            className={`grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_4.5rem_8rem_3.5rem] sm:items-center ${
              mismatch ? "bg-destructive/10" : ""
            }`}
          >
            <p className="min-w-0 truncate text-sm">
              {f.homeTeam} <span className="text-muted-foreground">v</span> {f.awayTeam}
            </p>
            <p className="text-right text-sm font-semibold tabular-nums sm:text-center">{resultText(f)}</p>
            <div className="min-w-0">
              {pick ? <PickBadge pick={pick} /> : <span className="text-xs text-muted-foreground">No pick</span>}
              {pick && pick.outcome && <p className="mt-0.5 text-[11px] text-muted-foreground">{pick.reason}</p>}
            </div>
            <p
              className={`text-right text-sm font-bold tabular-nums ${
                mismatch ? "text-destructive" : pick && pick.points > 0 ? "text-success" : "text-muted-foreground"
              }`}
              title={mismatch ? `Stored ${pick.points}, the scoring rule gives ${pick.expectedPoints}` : undefined}
            >
              {pick ? (mismatch ? `${pick.points}→${pick.expectedPoints}` : `+${pick.points}`) : "–"}
            </p>
          </div>
        );
      })}
    </div>
  );
};

const AdminMarking = () => {
  const { currentUser } = useApp();
  const isAdmin = currentUser?.role === "admin";
  const [pickedWeekId, setPickedWeekId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());

  const { competitionId, selectWeeks } = useCompetition("admin");
  const { data: weeks = [], isLoading: weeksLoading } = useQuery({
    queryKey: ["weeks"],
    queryFn: api.weeks.list,
    select: selectWeeks,
    enabled: isAdmin,
  });
  // Another competition: back to its current week.
  useEffect(() => setPickedWeekId(null), [competitionId]);
  const sortedWeeks = useMemo(() => sortWeeks(weeks).reverse(), [weeks]);
  const weekId = pickedWeekId ?? activeWeek(weeks)?.id ?? null;

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-marking", weekId],
    queryFn: () => api.admin.weeks.marking(weekId!),
    enabled: isAdmin && !!weekId,
    refetchInterval: 60_000,
  });

  const query = search.trim().toLowerCase();
  const visible = (data?.players ?? []).filter(
    (p) => !query || [p.name, p.whatsAppName].some((v) => v?.toLowerCase().includes(query)),
  );
  const mismatched = (data?.players ?? []).filter((p) => p.points !== p.expectedPoints);
  const finished = data?.fixtures.filter((f) => f.status === "ended").length ?? 0;
  const allOpen = visible.length > 0 && visible.every((p) => open.has(p.userId));

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <AdminLayout permission="marking.view">
      <div className="mx-auto max-w-5xl space-y-6 px-4 pb-10 pt-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Marking</h1>
            <p className="text-sm text-muted-foreground">
              Every player's picks with the result and the points each earned. Picks show once their match kicks off.
            </p>
            <CompetitionSwitcher scope="admin" className="mt-3" />
          </div>
          <Select value={weekId ?? undefined} onValueChange={setPickedWeekId} disabled={weeksLoading}>
            <SelectTrigger className="w-full sm:w-[240px]">
              <SelectValue placeholder="Choose a week" />
            </SelectTrigger>
            <SelectContent>
              {sortedWeeks.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load the marking."}
          </div>
        )}

        {(isLoading || weeksLoading) && <BrandLoader className="h-40" />}

        {data && (
          <>
            {/* Summary */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">Matches finished</p>
                <p className="mt-1.5 text-2xl font-bold tabular-nums">
                  {finished}
                  <span className="text-base font-medium text-muted-foreground"> / {data.fixtures.length}</span>
                </p>
              </div>
              <div
                className={`rounded-xl border p-4 ${
                  mismatched.length > 0 ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"
                }`}
              >
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {mismatched.length > 0 ? <CircleAlert className="h-3.5 w-3.5" /> : <CircleCheck className="h-3.5 w-3.5" />}
                  Points check
                </p>
                <p className={`mt-1.5 text-lg font-semibold ${mismatched.length > 0 ? "text-destructive" : ""}`}>
                  {mismatched.length > 0
                    ? `${mismatched.length} player${mismatched.length === 1 ? "" : "s"} to correct`
                    : "All points agree"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {mismatched.length > 0
                    ? "Corrected automatically within 15 minutes, or now with Recheck points on Fixtures."
                    : "Every pick is marked by the scoring rule below."}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {data.reconciledAt ? <ShieldCheck className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                  End-of-week check
                </p>
                {data.reconciledAt ? (
                  <>
                    <p className="mt-1.5 text-lg font-semibold text-success">Signed off</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(data.reconciledAt), "EEE d MMM, HH:mm")}</p>
                  </>
                ) : (
                  <>
                    <p className="mt-1.5 text-lg font-semibold">Not yet</p>
                    <p className="text-xs text-muted-foreground">Runs once every match in the week is over.</p>
                  </>
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Home win +{POINTS.home_win} · Away win +{POINTS.away_win} · Draw +{POINTS.draw} · Exact score +
              {POINTS.correct_score}, and a wrong exact score earns 0 even if it got the winner right.
            </p>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[160px] flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search players"
                  className="h-9 pl-8 text-sm"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto"
                onClick={() => setOpen(allOpen ? new Set() : new Set(visible.map((p) => p.userId)))}
              >
                {allOpen ? "Collapse all" : "Expand all"}
              </Button>
            </div>

            {/* Players */}
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {visible.length === 0 && <p className="p-10 text-center text-sm text-muted-foreground">No players match.</p>}
              {visible.map((p) => {
                const isOpen = open.has(p.userId);
                const mismatch = p.points !== p.expectedPoints;
                return (
                  <div key={p.userId}>
                    <button
                      onClick={() => toggle(p.userId)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{displayName(p)}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.whatsAppName && p.whatsAppName !== p.name && `${p.name} · `}
                          {p.picksMade} of {data.fixtures.length} picked
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-bold tabular-nums ${mismatch ? "text-destructive" : ""}`}>
                          {mismatch ? `${p.points}→${p.expectedPoints}` : p.points}
                        </p>
                        <p className="text-[10px] text-muted-foreground">pts</p>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {isOpen && <PlayerPicks player={p} fixtures={data.fixtures} />}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminMarking;
