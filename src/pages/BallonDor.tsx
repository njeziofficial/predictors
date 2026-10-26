import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNowStrict } from "date-fns";
import { ArrowDown, ArrowUp, Award, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import BallonDorBoard from "@/components/BallonDorBoard";
import NavBar from "@/components/NavBar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/context/AppContext";
import { api, type BallonDorDto } from "@/lib/api";
import { formatNaira } from "@/lib/wallet";

const PLACES = ["Winner", "2nd", "3rd", "4th", "5th"];
const EMPTY = ["", "", "", "", ""];

const Prizes = ({ game }: { game: BallonDorDto }) => (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xl font-bold tabular-nums text-primary">{formatNaira(game.winnerPotKobo)}</p>
      <p className="text-xs text-muted-foreground">Shared equally by everyone who picks the winner as their #1</p>
    </div>
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xl font-bold tabular-nums text-primary">{formatNaira(game.topFivePotKobo)}</p>
      <p className="text-xs text-muted-foreground">Shared equally by everyone who gets the whole top 5 in the right order</p>
    </div>
  </div>
);

/** Five places, each a nominee not already used in another place. */
const PickForm = ({ game, onSaved }: { game: BallonDorDto; onSaved: (g: BallonDorDto) => void }) => {
  const [picks, setPicks] = useState<string[]>(game.myPicks ?? EMPTY);
  const [saving, setSaving] = useState(false);
  const complete = picks.every(Boolean);
  const changed = picks.join("|") !== (game.myPicks ?? EMPTY).join("|");

  const set = (i: number, name: string) => setPicks((p) => p.map((x, j) => (j === i ? name : x)));
  const swap = (i: number, j: number) =>
    setPicks((p) => {
      const next = [...p];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const save = async () => {
    setSaving(true);
    try {
      onSaved(await api.ballonDor.submit(game.year, picks));
      toast.success("Your top 5 is in", { description: "You can change it until picks lock." });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save your picks.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-semibold">Your top 5</p>
      {picks.map((pick, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-xs font-semibold text-muted-foreground">{PLACES[i]}</span>
          <Select value={pick} onValueChange={(v) => set(i, v)}>
            <SelectTrigger className="min-w-0 flex-1" aria-label={`${PLACES[i]} pick`}>
              <SelectValue placeholder="Choose a player" />
            </SelectTrigger>
            <SelectContent>
              {game.nominees
                .filter((n) => n === pick || !picks.includes(n))
                .map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={i === 0} onClick={() => swap(i, i - 1)} aria-label="Move up">
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={i === 4} onClick={() => swap(i, i + 1)} aria-label="Move down">
            <ArrowDown className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button className="w-full" disabled={!complete || !changed || saving} onClick={save}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {game.myPicks ? "Update my top 5" : "Submit my top 5"}
      </Button>
      {!complete && <p className="text-center text-xs text-muted-foreground">Fill all five places to submit.</p>}
    </div>
  );
};

const BallonDor = () => {
  const { currentUser } = useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!currentUser) navigate("/");
  }, [currentUser, navigate]);

  const { data: game, isLoading, error, refetch } = useQuery({
    queryKey: ["ballon-dor"],
    queryFn: () => api.ballonDor.get(),
    enabled: !!currentUser,
    // Picks lock and results come in during the ceremony.
    refetchInterval: 60_000,
  });

  // No game, or switched off: the page isn't there (an old link or one left open lands on Predict).
  useEffect(() => {
    if (currentUser && !isLoading && !error && !game) navigate("/predict", { replace: true });
  }, [currentUser, isLoading, error, game, navigate]);

  // Re-read the moment picks lock, so everyone's picks appear.
  useEffect(() => {
    if (!game || game.locked) return;
    const ms = new Date(game.locksAt).getTime() - Date.now();
    if (ms > 2 ** 31 - 1) return;
    const t = setTimeout(() => refetch(), Math.max(ms, 0) + 1000);
    return () => clearTimeout(t);
  }, [game, refetch]);

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-background pb-8 page-transition">
      <NavBar />
      <div className="mx-auto max-w-2xl space-y-5 px-4 pt-6 sm:px-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Award className="h-6 w-6 text-primary" /> Ballon d'Or{game ? ` ${game.year}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">Rank your top 5. Free to play. Prizes go straight to your wallet.</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Couldn't load the Ballon d'Or game."}
          </p>
        ) : !game ? (
          <p className="py-16 text-center text-sm text-muted-foreground">There's no Ballon d'Or game open right now.</p>
        ) : (
          <>
            <Prizes game={game} />

            {game.result ? (
              <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
                <p className="text-sm font-semibold">The result</p>
                <ol className="mt-2 space-y-1 text-sm">
                  {game.result.map((name, i) => (
                    <li key={name}>
                      <span className="inline-block w-14 text-xs font-semibold text-muted-foreground">{PLACES[i]}</span>
                      {name}
                    </li>
                  ))}
                </ol>
              </div>
            ) : game.locked ? (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                <Lock className="h-5 w-5 shrink-0 text-muted-foreground" />
                <p className="text-sm">
                  Picks are locked. Prizes are paid once the result is in.
                </p>
              </div>
            ) : (
              <p className="text-sm">
                Picks lock <span className="font-semibold">{format(new Date(game.locksAt), "EEE d MMM, h:mm a")}</span> (in{" "}
                {formatDistanceToNowStrict(new Date(game.locksAt))}). Nobody sees your picks until then.{" "}
                <span className="text-muted-foreground">{game.entries === 1 ? "1 player has" : `${game.entries} players have`} picked.</span>
              </p>
            )}

            {!game.locked && (
              <PickForm
                key={game.myPicks?.join("|") ?? "new"}
                game={game}
                onSaved={(g) => queryClient.setQueryData(["ballon-dor"], g)}
              />
            )}

            {game.locked && (
              <div className="rounded-xl border border-border bg-card px-4">
                <p className="border-b border-border py-3 text-sm font-semibold">
                  Everyone's picks{game.myPicks ? "" : " (you didn't pick)"}
                </p>
                <BallonDorBoard game={game} me={currentUser.id} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BallonDor;
