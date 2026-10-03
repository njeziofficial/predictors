import { useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { api, type FixtureDto, type MatchWeekDto, type FixtureStatusName } from "@/lib/api";
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

  const { mutate: deleteFixture, isPending: isDeletingFixture } = useMutation({
    mutationFn: (id: string) => api.admin.fixtures.remove(id),
    onSuccess: () => {
      toast.success("Fixture deleted.");
      setPendingDeleteFixture(null);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete fixture."),
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
    <AdminLayout>
      <div className="mx-auto max-w-4xl px-6 pt-8 pb-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Fixtures</h1>
            <p className="text-sm text-muted-foreground">Manage match weeks and fixtures</p>
          </div>
          <WeekFormDialog
            onSaved={invalidate}
            trigger={
              <Button size="sm">
                <Plus className="h-3.5 w-3.5 mr-1" /> New week
              </Button>
            }
          />
        </div>

        {isLoading && (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
            <p className="text-sm text-destructive font-medium">Failed to load weeks</p>
          </div>
        )}

        {weeks?.map((week) => (
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
      </div>
    </AdminLayout>
  );
};

export default AdminFixtures;
