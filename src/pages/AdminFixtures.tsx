import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Calculator } from "lucide-react";
import { BrandLoader } from "@/components/Brand";
import { api, type FixtureDto, type MatchWeekDto, type FixtureStatusName, type PointsCorrectionDto } from "@/lib/api";
import AdminLayout from "@/components/AdminLayout";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

const statusOptions: { value: FixtureStatusName; label: string }[] = [
  { value: "PreMatch", label: "Pre-match" },
  { value: "Live", label: "Live" },
  { value: "HalfTime", label: "Half-time" },
  { value: "Ended", label: "Ended" },
  { value: "Postponed", label: "Postponed" },
  { value: "Cancelled", label: "Cancelled" },
];

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const WeekFormDialog = ({
  week,
  trigger,
  onSaved,
}: {
  week?: MatchWeekDto;
  trigger: ReactNode;
  onSaved: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(week?.name ?? "");
  const [competition, setCompetition] = useState(week?.competition ?? "");

  const { mutate: save, isPending } = useMutation({
    mutationFn: () =>
      week ? api.admin.weeks.update(week.id, name, competition) : api.admin.weeks.create(name, competition),
    onSuccess: () => {
      toast.success(week ? "Week updated." : "Week created.");
      setOpen(false);
      onSaved();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save week."),
  });

  const valid = name.trim().length > 0 && competition.trim().length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setName(week?.name ?? "");
          setCompetition(week?.competition ?? "");
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{week ? "Edit week" : "New week"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="week-name">Name</Label>
            <Input id="week-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="week-competition">Competition</Label>
            <Input id="week-competition" value={competition} onChange={(e) => setCompetition(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={!valid || isPending} onClick={() => save()}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const FixtureFormDialog = ({
  weekId,
  weeks,
  fixture,
  trigger,
  onSaved,
}: {
  weekId: string;
  weeks: MatchWeekDto[];
  fixture?: FixtureDto;
  trigger: ReactNode;
  onSaved: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [homeTeam, setHomeTeam] = useState(fixture?.homeTeam ?? "");
  const [awayTeam, setAwayTeam] = useState(fixture?.awayTeam ?? "");
  const [kickoff, setKickoff] = useState(fixture ? toDatetimeLocal(fixture.kickoff) : "");
  const [status, setStatus] = useState<FixtureStatusName>("PreMatch");
  const [homeScore, setHomeScore] = useState(fixture?.finalScore?.home?.toString() ?? "");
  const [awayScore, setAwayScore] = useState(fixture?.finalScore?.away?.toString() ?? "");
  const [targetWeekId, setTargetWeekId] = useState(fixture?.weekId ?? weekId);

  const { mutate: save, isPending } = useMutation({
    mutationFn: () => {
      const kickoffIso = new Date(kickoff).toISOString();
      if (!fixture) {
        return api.admin.fixtures.create(weekId, homeTeam, awayTeam, kickoffIso);
      }
      const scored = status === "Ended";
      return api.admin.fixtures.update(fixture.id, {
        homeTeam,
        awayTeam,
        kickoffIso,
        status,
        finalScoreHome: scored ? Number(homeScore) : undefined,
        finalScoreAway: scored ? Number(awayScore) : undefined,
        weekId: targetWeekId,
      });
    },
    onSuccess: () => {
      toast.success(fixture ? "Fixture updated." : "Fixture created.");
      setOpen(false);
      onSaved();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save fixture."),
  });

  const needsScore = status === "Ended";
  const scoreValid = !needsScore || (homeScore.trim() !== "" && awayScore.trim() !== "");
  const valid = homeTeam.trim().length > 0 && awayTeam.trim().length > 0 && kickoff.trim().length > 0 && scoreValid;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setHomeTeam(fixture?.homeTeam ?? "");
          setAwayTeam(fixture?.awayTeam ?? "");
          setKickoff(fixture ? toDatetimeLocal(fixture.kickoff) : "");
          setHomeScore(fixture?.finalScore?.home?.toString() ?? "");
          setAwayScore(fixture?.finalScore?.away?.toString() ?? "");
          setTargetWeekId(fixture?.weekId ?? weekId);
          if (fixture) setStatus(mapReadStatusToWriteStatus(fixture.status));
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{fixture ? "Edit fixture" : "New fixture"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="home-team">Home team</Label>
              <Input id="home-team" value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="away-team">Away team</Label>
              <Input id="away-team" value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kickoff">Kickoff</Label>
            <Input
              id="kickoff"
              type="datetime-local"
              value={kickoff}
              onChange={(e) => setKickoff(e.target.value)}
            />
          </div>
          {fixture && (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as FixtureStatusName)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {fixture && (
            <div className="space-y-1.5">
              <Label>Week</Label>
              <Select value={targetWeekId} onValueChange={setTargetWeekId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {weeks.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {fixture && needsScore && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="home-score">Home score</Label>
                <Input
                  id="home-score"
                  type="number"
                  min={0}
                  value={homeScore}
                  onChange={(e) => setHomeScore(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="away-score">Away score</Label>
                <Input
                  id="away-score"
                  type="number"
                  min={0}
                  value={awayScore}
                  onChange={(e) => setAwayScore(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button disabled={!valid || isPending} onClick={() => save()}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

function mapReadStatusToWriteStatus(s: FixtureDto["status"]): FixtureStatusName {
  switch (s) {
    case "pre_match":
      return "PreMatch";
    case "live":
      return "Live";
    case "ended":
      return "Ended";
    case "postponed":
      return "Postponed";
    case "cancelled":
      return "Cancelled";
    default:
      return "PreMatch";
  }
}

const AdminFixtures = () => {
  const queryClient = useQueryClient();
  const { currentUser } = useApp();
  const [pendingDeleteFixture, setPendingDeleteFixture] = useState<string | null>(null);
  const [pendingDeleteWeek, setPendingDeleteWeek] = useState<string | null>(null);

  const { data: weeks, isLoading, error } = useQuery({
    queryKey: ["weeks"],
    queryFn: api.weeks.list,
    enabled: currentUser?.role === "admin",
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["weeks"] });

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  const totalCount = weeks?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Deleting the last week on the final page would otherwise strand you on an empty page.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedWeeks = weeks?.slice((page - 1) * pageSize, page * pageSize);

  const { mutate: deleteFixture, isPending: isDeletingFixture } = useMutation({
    mutationFn: (id: string) => api.admin.fixtures.remove(id),
    onSuccess: () => {
      toast.success("Fixture deleted.");
      setPendingDeleteFixture(null);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete fixture."),
  });

  const [corrections, setCorrections] = useState<PointsCorrectionDto[] | null>(null);
  const { mutate: recheckPoints, isPending: isRechecking } = useMutation({
    mutationFn: api.admin.recheckPoints,
    onSuccess: (result) => {
      if (result.length === 0) toast.success("All points are correct. Nothing to fix.");
      else setCorrections(result);
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["predictions"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to recheck points."),
  });

  const { mutate: deleteWeek, isPending: isDeletingWeek } = useMutation({
    mutationFn: (id: string) => api.admin.weeks.remove(id),
    onSuccess: () => {
      toast.success("Week deleted.");
      setPendingDeleteWeek(null);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete week."),
  });

  return (
    <AdminLayout permission="fixtures.manage">
      <div className="mx-auto max-w-4xl px-6 pt-8 pb-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Fixtures</h1>
            <p className="text-sm text-muted-foreground">Manage match weeks and fixtures</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => recheckPoints()}
              disabled={isRechecking}
              title="Recalculate every player's points from the results and fix any that are wrong. Also runs automatically every 15 minutes."
            >
              {isRechecking ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Calculator className="h-3.5 w-3.5 mr-1" />}
              Recheck points
            </Button>
            <WeekFormDialog
              onSaved={invalidate}
              trigger={
                <Button size="sm">
                  <Plus className="h-3.5 w-3.5 mr-1" /> New week
                </Button>
              }
            />
          </div>
        </div>

        <Dialog open={corrections !== null} onOpenChange={(open) => !open && setCorrections(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Fixed {corrections?.length} prediction{corrections?.length === 1 ? "" : "s"}</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground">
              These points didn't match the results and have been corrected. The standings now include the fixes,
              and each change is recorded in the audit trail.
            </p>
            <div className="max-h-80 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead>Match</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {corrections?.map((c) => (
                    <TableRow key={c.predictionId}>
                      <TableCell>{c.userName}</TableCell>
                      <TableCell>
                        {c.match}
                        {c.previousWeekId !== c.weekId && (
                          <span className="block text-[10px] text-muted-foreground">Moved to the match's week</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {c.previousPoints === c.points ? c.points : `${c.previousPoints} → ${c.points}`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DialogFooter>
              <Button onClick={() => setCorrections(null)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {isLoading && (
          <BrandLoader className="h-32" />
        )}

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
            <p className="text-sm text-destructive font-medium">Failed to load weeks</p>
          </div>
        )}

        {weeks && weeks.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No match weeks yet.</p>
        )}

        {pagedWeeks?.map((week) => (
          <div key={week.id} className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div>
                <p className="text-sm font-semibold">{week.name}</p>
                <p className="text-xs text-muted-foreground">{week.competition}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <FixtureFormDialog
                  weekId={week.id}
                  weeks={weeks ?? []}
                  onSaved={invalidate}
                  trigger={
                    <Button variant="outline" size="sm">
                      <Plus className="h-3.5 w-3.5 mr-1" /> Fixture
                    </Button>
                  }
                />
                <WeekFormDialog
                  week={week}
                  onSaved={invalidate}
                  trigger={
                    <Button variant="outline" size="sm">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  }
                />
                <AlertDialog
                  open={pendingDeleteWeek === week.id}
                  onOpenChange={(open) => setPendingDeleteWeek(open ? week.id : null)}
                >
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {week.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This permanently deletes the week, all of its fixtures, and every prediction made against
                        them. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction disabled={isDeletingWeek} onClick={() => deleteWeek(week.id)}>
                        {isDeletingWeek && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            {week.fixtures.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted-foreground">No fixtures yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Match</TableHead>
                    <TableHead>Kickoff</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {week.fixtures.map((fixture) => (
                    <TableRow key={fixture.id}>
                      <TableCell className="font-medium">
                        {fixture.homeTeam} vs {fixture.awayTeam}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(fixture.kickoff), "MMM d, HH:mm")}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{fixture.status}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {fixture.finalScore ? `${fixture.finalScore.home}-${fixture.finalScore.away}` : "—"}
                      </TableCell>
                      <TableCell className="text-right space-x-1 whitespace-nowrap">
                        <FixtureFormDialog
                          weekId={week.id}
                          weeks={weeks ?? []}
                          fixture={fixture}
                          onSaved={invalidate}
                          trigger={
                            <Button variant="outline" size="sm">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          }
                        />
                        <AlertDialog
                          open={pendingDeleteFixture === fixture.id}
                          onOpenChange={(open) => setPendingDeleteFixture(open ? fixture.id : null)}
                        >
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Delete {fixture.homeTeam} vs {fixture.awayTeam}?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This permanently deletes the fixture and every prediction made against it. This
                                cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                disabled={isDeletingFixture}
                                onClick={() => deleteFixture(fixture.id)}
                              >
                                {isDeletingFixture && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        ))}

        {weeks && totalCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-3">
              <p className="text-muted-foreground">
                Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} of {totalCount} weeks
              </p>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="h-8 w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} / page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
              </Button>
              <span className="text-muted-foreground text-xs">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminFixtures;
