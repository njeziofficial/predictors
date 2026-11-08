import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Award, Loader2 } from "lucide-react";
import { toast } from "sonner";
import AdminLayout from "@/components/AdminLayout";
import BallonDorBoard from "@/components/BallonDorBoard";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api, type BallonDorDto } from "@/lib/api";
import { usePermissions } from "@/lib/permissions";
import { formatNaira, parseNaira } from "@/lib/wallet";

const KEY = ["admin-ballon-dor"];
const PLACES = ["Winner", "2nd", "3rd", "4th", "5th"];
const errorMessage = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

// <input type="datetime-local"> works in the admin's own time zone.
const toLocalInput = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");

/** The nominees, the lock time and the prizes. Fixed once the result is in. */
const Setup = ({ game, canManage, onSaved }: { game?: BallonDorDto; canManage: boolean; onSaved: (g: BallonDorDto) => void }) => {
  const [year, setYear] = useState(String(game?.year ?? new Date().getFullYear()));
  const [nominees, setNominees] = useState(game?.nominees.join("\n") ?? "");
  const [locksAt, setLocksAt] = useState(() => {
    if (game) return toLocalInput(new Date(game.locksAt));
    const tonight = new Date();
    tonight.setHours(20, 45, 0, 0);
    return toLocalInput(tonight);
  });
  const [winnerPot, setWinnerPot] = useState(String((game?.winnerPotKobo ?? 250000) / 100));
  const [topFivePot, setTopFivePot] = useState(String((game?.topFivePotKobo ?? 250000) / 100));
  const [saving, setSaving] = useState(false);
  const fixed = !canManage || !!game?.result;
  const names = nominees.split("\n").map((n) => n.trim()).filter(Boolean);

  const save = async () => {
    const winnerPotKobo = parseNaira(winnerPot);
    const topFivePotKobo = parseNaira(topFivePot);
    if (winnerPotKobo === null || topFivePotKobo === null) {
      toast.error("Enter the prizes in naira, like 2,500.");
      return;
    }
    setSaving(true);
    try {
      onSaved(
        await api.admin.ballonDor.save({
          year: Number(year),
          nominees: names,
          locksAt: new Date(locksAt).toISOString(),
          winnerPotKobo,
          topFivePotKobo,
        }),
      );
      toast.success(game ? "Ballon d'Or game updated" : "Ballon d'Or game is open", {
        description: game ? undefined : "Players can find it under Ballon d'Or in the app.",
      });
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save the game."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-semibold">{game ? "The game" : "Open the game"}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="bd-year">Year</Label>
          <Input id="bd-year" inputMode="numeric" value={year} disabled={fixed || !!game} onChange={(e) => setYear(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bd-lock">Picks lock at (your time)</Label>
          <Input id="bd-lock" type="datetime-local" value={locksAt} disabled={fixed} onChange={(e) => setLocksAt(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bd-winner">Prize for the winner (₦)</Label>
          <NairaInput id="bd-winner" value={winnerPot} disabled={fixed} onValueChange={setWinnerPot} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bd-top5">Prize for the top 5 in order (₦)</Label>
          <NairaInput id="bd-top5" value={topFivePot} disabled={fixed} onValueChange={setTopFivePot} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bd-nominees">Nominees, one per line ({names.length})</Label>
        <Textarea
          id="bd-nominees"
          rows={10}
          value={nominees}
          disabled={fixed}
          placeholder={"Ousmane Dembélé\nLamine Yamal\n…"}
          onChange={(e) => setNominees(e.target.value)}
        />
      </div>
      {canManage && (
        <Button disabled={fixed || saving || names.length < 5} onClick={save}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {game ? "Save changes" : "Open the game"}
        </Button>
      )}
      {game?.result && <p className="text-xs text-muted-foreground">The result is in. Clear it to change the game.</p>}
    </div>
  );
};

/** The real top 5. Entering it pays the prizes into the winners' wallets. */
const Result = ({ game, onSaved }: { game: BallonDorDto; onSaved: (g: BallonDorDto) => void }) => {
  const [result, setResult] = useState<string[]>(game.result ?? ["", "", "", "", ""]);
  const [confirming, setConfirming] = useState<"publish" | "clear" | null>(null);
  const [saving, setSaving] = useState(false);
  const complete = result.every(Boolean);

  // What the result in the form would pay, to confirm before any money moves.
  const board = game.board ?? [];
  const winners = board.filter((e) => e.picks[0] === result[0]).length;
  const topFive = board.filter((e) => e.picks.every((p, i) => p === result[i])).length;

  const submit = async (next: string[] | null) => {
    setSaving(true);
    try {
      onSaved(await api.admin.ballonDor.setResult(game.year, next));
      toast.success(next ? "Result published and prizes paid into wallets" : "Result cleared and prizes taken back");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save the result."));
    } finally {
      setSaving(false);
      setConfirming(null);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-semibold">The result</p>
      {result.map((pick, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-xs font-semibold text-muted-foreground">{PLACES[i]}</span>
          <Select value={pick} onValueChange={(v) => setResult((r) => r.map((x, j) => (j === i ? v : x)))}>
            <SelectTrigger className="min-w-0 flex-1" aria-label={`${PLACES[i]} in the result`}>
              <SelectValue placeholder="Choose a player" />
            </SelectTrigger>
            <SelectContent>
              {game.nominees
                .filter((n) => n === pick || !result.includes(n))
                .map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button disabled={!complete || saving} onClick={() => setConfirming("publish")}>
          {game.result ? "Correct the result" : "Publish result & pay prizes"}
        </Button>
        {game.result && (
          <Button variant="outline" disabled={saving} onClick={() => setConfirming("clear")}>
            Clear the result
          </Button>
        )}
      </div>

      <AlertDialog open={!!confirming} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirming === "clear" ? "Clear the result?" : "Publish the result?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirming === "clear" ? (
                "Every Ballon d'Or prize already paid into a wallet is reversed."
              ) : (
                <>
                  {winners === 0
                    ? "Nobody called the winner, so that prize isn't paid."
                    : `${formatNaira(game.winnerPotKobo)} shared by ${winners} (${formatNaira(Math.floor(game.winnerPotKobo / winners))} each) for calling the winner.`}{" "}
                  {topFive === 0
                    ? "Nobody called the top 5 in order, so that prize isn't paid."
                    : `${formatNaira(game.topFivePotKobo)} shared by ${topFive} (${formatNaira(Math.floor(game.topFivePotKobo / topFive))} each) for the top 5 in order.`}{" "}
                  Prizes go into the winners' wallets as owed to them.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                void submit(confirming === "clear" ? null : result);
              }}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirming === "clear" ? "Clear it" : "Publish and pay"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// Whether players see the game. Everyone here sees the state; only the system user switches it.
const Visibility = ({ game, isSystemUser, onSaved }: { game: BallonDorDto; isSystemUser: boolean; onSaved: (g: BallonDorDto) => void }) => {
  const [saving, setSaving] = useState(false);

  const toggle = async (on: boolean) => {
    setSaving(true);
    try {
      onSaved(await api.admin.ballonDor.setEnabled(game.year, on));
      toast.success(on ? "Ballon d'Or is showing to players" : "Ballon d'Or is hidden from players");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't change it."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
      <div>
        <p className="text-sm font-semibold">{game.enabled ? "Showing to players" : "Hidden from players"}</p>
        <p className="text-xs text-muted-foreground">
          {game.enabled
            ? "Players see Ballon d'Or in the menu and can pick."
            : "Off: no menu link, no page and no picks for players. Picks already made are kept."}
          {!isSystemUser && " Only the system admin can switch this."}
        </p>
      </div>
      {isSystemUser && (
        <Switch aria-label="Show Ballon d'Or to players" checked={game.enabled} onCheckedChange={toggle} disabled={saving} />
      )}
    </div>
  );
};

const AdminBallonDor = () => {
  const { can, isSystemUser } = usePermissions();
  const canManage = can("wallet.manage");
  const queryClient = useQueryClient();
  const { data: game, isLoading, error, refetch } = useQuery({
    queryKey: KEY,
    queryFn: () => api.admin.ballonDor.get(),
    enabled: can("wallet.view"),
    refetchInterval: 60_000,
  });

  // Re-read the moment picks lock, so the result form appears.
  useEffect(() => {
    if (!game || game.locked) return;
    const ms = new Date(game.locksAt).getTime() - Date.now();
    if (ms > 2 ** 31 - 1) return;
    const t = setTimeout(() => refetch(), Math.max(ms, 0) + 1000);
    return () => clearTimeout(t);
  }, [game, refetch]);

  const onSaved = (g: BallonDorDto) => {
    queryClient.setQueryData(KEY, g);
    queryClient.invalidateQueries({ queryKey: ["ballon-dor"] });
    queryClient.invalidateQueries({ queryKey: ["admin-wallet"] });
    queryClient.invalidateQueries({ queryKey: ["wallet"] });
  };

  return (
    <AdminLayout permission="wallet.view">
      <div className="mx-auto max-w-3xl space-y-5 px-4 pt-6 pb-8 sm:px-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Award className="h-6 w-6 text-primary" /> Ballon d'Or
          </h1>
          <p className="text-sm text-muted-foreground">
            A free side game: players rank their top 5 before the ceremony. Prizes are your own money, paid into the
            winners' wallets as adjustments, so the season pot isn't touched.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="py-16 text-center text-sm text-muted-foreground">{errorMessage(error, "Couldn't load the game.")}</p>
        ) : (
          <>
            {game && <Visibility game={game} isSystemUser={isSystemUser} onSaved={onSaved} />}
            <Setup key={game?.year ?? "new"} game={game} canManage={canManage} onSaved={onSaved} />
            {game && (
              <>
                {game.locked && canManage ? (
                  <Result key={game.result?.join("|") ?? "none"} game={game} onSaved={onSaved} />
                ) : (
                  !game.locked && (
                    <p className="text-sm text-muted-foreground">
                      You can enter the result once picks lock at {format(new Date(game.locksAt), "EEE d MMM, h:mm a")}.
                    </p>
                  )
                )}
                <div className="rounded-xl border border-border bg-card px-4">
                  <p className="border-b border-border py-3 text-sm font-semibold">
                    Picks ({game.entries}){!game.locked && " · hidden from players until the lock"}
                  </p>
                  <BallonDorBoard game={game} />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminBallonDor;
