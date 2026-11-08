import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CircleAlert, CircleCheck, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import AdminLayout from "@/components/AdminLayout";
import CompetitionSwitcher from "@/components/CompetitionSwitcher";
import NairaInput from "@/components/NairaInput";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCompetition } from "@/context/CompetitionContext";
import { api, type SpecialGameDto, type SpecialPrizeDto } from "@/lib/api";
import { usePermissions } from "@/lib/permissions";
import { isFixtureOpen } from "@/lib/predictionRules";
import { formatNaira, parseNaira } from "@/lib/wallet";

const KEY = ["admin-special-games"];
const VISIBILITY_KEY = ["admin-special-games-enabled"];
const errorMessage = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);
const when = (iso: string) => format(new Date(iso), "EEE d MMM, h:mm a");

type OnSaved = (games: SpecialGameDto[]) => void;

/** Picks an upcoming match of the competition being viewed and puts a pot on it. */
const NewGame = ({ taken, onSaved }: { taken: ReadonlySet<string>; onSaved: OnSaved }) => {
  const { selectWeeks } = useCompetition("admin");
  const { data: weeks } = useQuery({ queryKey: ["weeks"], queryFn: api.weeks.list, select: selectWeeks });
  const [fixtureId, setFixtureId] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const now = new Date();
  const upcoming = (weeks ?? [])
    .flatMap((w) => w.fixtures.map((f) => ({ ...f, weekName: w.name })))
    .filter((f) => isFixtureOpen(f, now) && !taken.has(f.id))
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
  const kobo = parseNaira(amount);
  const chosen = upcoming.some((f) => f.id === fixtureId);

  const save = async () => {
    if (!chosen || !kobo || kobo <= 0) return;
    setSaving(true);
    try {
      onSaved(await api.admin.specialGames.setPot(fixtureId, kobo));
      toast.success("Special game set", { description: "Players can now only predict its exact score." });
      setFixtureId("");
      setAmount("");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't set the special game."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-semibold">Make a match special</p>
      <CompetitionSwitcher scope="admin" />
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
        <div className="min-w-0 space-y-1.5">
          <Label>Match</Label>
          <Select value={chosen ? fixtureId : ""} onValueChange={setFixtureId}>
            <SelectTrigger aria-label="Match">
              <SelectValue placeholder={upcoming.length ? "Choose a match" : "No upcoming matches"} />
            </SelectTrigger>
            <SelectContent>
              {upcoming.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.homeTeam} vs {f.awayTeam} · {f.weekName} · {format(new Date(f.kickoff), "d MMM, h:mm a")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="special-pot">Pot (₦)</Label>
          <NairaInput id="special-pot" value={amount} onValueChange={setAmount} placeholder="10,000" />
        </div>
      </div>
      {amount && (kobo === null || kobo <= 0) && <p className="text-xs text-destructive">Enter an amount like 10,000 or 1,250.50.</p>}
      <Button disabled={saving || !chosen || !kobo || kobo <= 0} onClick={save}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Set as special
      </Button>
    </div>
  );
};

const PotDialog = ({ game, onClose, onSaved }: { game: SpecialGameDto; onClose: () => void; onSaved: OnSaved }) => {
  const [amount, setAmount] = useState(String(game.potKobo / 100));
  const [saving, setSaving] = useState(false);
  const kobo = parseNaira(amount);

  const save = async () => {
    if (!kobo || kobo <= 0) return;
    setSaving(true);
    try {
      onSaved(await api.admin.specialGames.setPot(game.fixtureId, kobo));
      toast.success("Pot updated");
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't change the pot."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change the pot</DialogTitle>
          <DialogDescription>
            {game.homeTeam} vs {game.awayTeam}. Any prizes already in wallets are updated to match.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="edit-pot">Pot (₦)</Label>
          <NairaInput id="edit-pot" value={amount} onValueChange={setAmount} autoFocus />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !kobo || kobo <= 0}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Winner = ({ game, prize, onSaved }: { game: SpecialGameDto; prize: SpecialPrizeDto; onSaved: OnSaved }) => {
  const [saving, setSaving] = useState(false);
  const name = prize.whatsAppName || prize.name;

  const setPaid = async (paid: boolean) => {
    setSaving(true);
    try {
      onSaved(await api.admin.specialGames.setPaid(game.fixtureId, prize.userId, paid));
      toast.success(paid ? `${name} marked as paid` : `${name} marked as unpaid`);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't change it."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs tabular-nums text-muted-foreground">
          {formatNaira(prize.amountKobo)}
          {prize.paidAt && <> · paid {format(new Date(prize.paidAt), "d MMM yyyy")}</>}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {prize.paid ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
            <CircleCheck className="h-3 w-3" /> Paid
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
            <CircleAlert className="h-3 w-3" /> Not paid
          </span>
        )}
        <Button size="sm" variant={prize.paid ? "ghost" : "default"} disabled={saving} onClick={() => setPaid(!prize.paid)}>
          {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          {prize.paid ? "Mark unpaid" : "Mark as paid"}
        </Button>
      </div>
    </li>
  );
};

const GameCard = ({ game, onSaved }: { game: SpecialGameDto; onSaved: OnSaved }) => {
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [saving, setSaving] = useState(false);
  const ended = game.status === "ended" && game.finalScore;

  const remove = async () => {
    setSaving(true);
    try {
      onSaved(await api.admin.specialGames.remove(game.fixtureId));
      toast.success("Special game removed");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't remove it."));
    } finally {
      setSaving(false);
      setRemoving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">
            {game.homeTeam} vs {game.awayTeam}
            {ended && <span className="tabular-nums"> · {game.finalScore!.home}-{game.finalScore!.away}</span>}
          </p>
          <p className="text-xs text-muted-foreground">
            {game.competition} · {game.weekName} · {when(game.kickoff)}
          </p>
        </div>
        <p className="text-lg font-bold tabular-nums text-primary">{formatNaira(game.potKobo)}</p>
      </div>

      <p className="text-xs text-muted-foreground">
        {game.scorePicks === 1 ? "1 score predicted" : `${game.scorePicks} scores predicted`}
        {game.outdatedPicks > 0 && ` · ${game.outdatedPicks} older result ${game.outdatedPicks === 1 ? "pick" : "picks"} can't win`}
        {ended && game.prizes.length === 0 && " · nobody got it, so the pot isn't paid"}
      </p>

      {game.problem && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> <span>{game.problem}</span>
        </div>
      )}

      {game.prizes.length > 0 && (
        <ul className="divide-y divide-border border-t border-border">
          {game.prizes.map((p) => (
            <Winner key={p.userId} game={game} prize={p} onSaved={onSaved} />
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          Change pot
        </Button>
        <Button size="sm" variant="outline" onClick={() => setRemoving(true)}>
          Remove
        </Button>
      </div>

      {editing && <PotDialog game={game} onClose={() => setEditing(false)} onSaved={onSaved} />}
      <AlertDialog open={removing} onOpenChange={setRemoving}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this special game?</AlertDialogTitle>
            <AlertDialogDescription>
              {game.homeTeam} vs {game.awayTeam} goes back to a normal match. Prizes already in wallets are taken back; a prize
              marked as paid has to be marked as unpaid first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                void remove();
              }}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// Whether players see special games at all.
const Visibility = ({ enabled, onChange }: { enabled: boolean; onChange: (enabled: boolean) => void }) => {
  const [saving, setSaving] = useState(false);

  const toggle = async (on: boolean) => {
    setSaving(true);
    try {
      onChange((await api.admin.specialGames.setEnabled(on)).enabled);
      toast.success(on ? "Special games are showing to players" : "Special games are hidden from players");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't change it."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
      <div>
        <p className="text-sm font-semibold">{enabled ? "Showing to players" : "Hidden from players"}</p>
        <p className="text-xs text-muted-foreground">
          {enabled
            ? "Players see the pot on these matches and can only predict the exact score."
            : "Off: these play as normal matches and no new prizes are paid. Prizes already in wallets stay, and can still be marked as paid."}
        </p>
      </div>
      <Switch aria-label="Show special games to players" checked={enabled} onCheckedChange={toggle} disabled={saving} />
    </div>
  );
};

const AdminSpecialGames = () => {
  const { can } = usePermissions();
  const allowed = can("special_games.manage");
  const queryClient = useQueryClient();
  const { data: games, isLoading, error } = useQuery({
    queryKey: KEY,
    queryFn: api.admin.specialGames.list,
    enabled: allowed,
    refetchInterval: 60_000,
  });
  const { data: visibility } = useQuery({
    queryKey: VISIBILITY_KEY,
    queryFn: api.admin.specialGames.enabled,
    enabled: allowed,
  });

  const onSaved: OnSaved = (next) => {
    queryClient.setQueryData(KEY, next);
    queryClient.invalidateQueries({ queryKey: ["weeks"] });
    queryClient.invalidateQueries({ queryKey: ["admin-wallet"] });
    queryClient.invalidateQueries({ queryKey: ["wallet"] });
  };

  return (
    <AdminLayout permission="special_games.manage">
      <div className="mx-auto max-w-3xl space-y-5 px-4 pb-8 pt-6 sm:px-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Sparkles className="h-6 w-6 text-primary" /> Special games
          </h1>
          <p className="text-sm text-muted-foreground">
            Players can only predict the exact score. When the match ends, everyone who got it shares your pot equally in their
            wallets, separate from the season pot. Mark each winner as paid once you've sent the money.
          </p>
        </div>

        {visibility && (
          <Visibility
            enabled={visibility.enabled}
            onChange={(enabled) => {
              queryClient.setQueryData(VISIBILITY_KEY, { enabled });
              queryClient.invalidateQueries({ queryKey: KEY });
              queryClient.invalidateQueries({ queryKey: ["weeks"] });
              queryClient.invalidateQueries({ queryKey: ["admin-wallet"] });
              queryClient.invalidateQueries({ queryKey: ["wallet"] });
            }}
          />
        )}

        <NewGame taken={new Set(games?.map((g) => g.fixtureId))} onSaved={onSaved} />

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="py-16 text-center text-sm text-muted-foreground">{errorMessage(error, "Couldn't load special games.")}</p>
        ) : games?.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No special games yet.</p>
        ) : (
          games?.map((g) => <GameCard key={g.fixtureId} game={g} onSaved={onSaved} />)
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminSpecialGames;
