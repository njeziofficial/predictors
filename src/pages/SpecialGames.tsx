import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import NavBar from "@/components/NavBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/context/AppContext";
import { api, type PlayerSpecialGameDto } from "@/lib/api";
import { formatNaira } from "@/lib/wallet";

const KEY = ["special-games"];
const validGoals = (value: string) => /^\d{1,2}$/.test(value);

const ScoreForm = ({ game, onSaved }: { game: PlayerSpecialGameDto; onSaved: (games: PlayerSpecialGameDto[]) => void }) => {
  const [home, setHome] = useState(game.myHomeGoals?.toString() ?? "");
  const [away, setAway] = useState(game.myAwayGoals?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const saved = game.myHomeGoals != null;
  const changed = home !== (game.myHomeGoals?.toString() ?? "") || away !== (game.myAwayGoals?.toString() ?? "");

  const save = async () => {
    setSaving(true);
    try {
      onSaved(await api.specialGames.submit(game.fixtureId, Number(home), Number(away)));
      toast.success("Your score is in", { description: "You can change it until the game locks." });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save your score.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-2">
        <span className="min-w-0 flex-1 text-right text-sm font-semibold">{game.homeTeam}</span>
        <Input
          type="number"
          min={0}
          max={99}
          inputMode="numeric"
          aria-label={`${game.homeTeam} goals`}
          className="h-10 w-14 bg-secondary text-center"
          placeholder="0"
          value={home}
          onChange={(e) => setHome(e.target.value)}
        />
        <span className="text-muted-foreground">-</span>
        <Input
          type="number"
          min={0}
          max={99}
          inputMode="numeric"
          aria-label={`${game.awayTeam} goals`}
          className="h-10 w-14 bg-secondary text-center"
          placeholder="0"
          value={away}
          onChange={(e) => setAway(e.target.value)}
        />
        <span className="min-w-0 flex-1 text-sm font-semibold">{game.awayTeam}</span>
      </div>
      <Button className="w-full" disabled={saving || !changed || !validGoals(home) || !validGoals(away)} onClick={save}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {saved ? "Update my score" : "Submit my score"}
      </Button>
    </div>
  );
};

/** Where a game that has stopped taking scores stands for this player. */
const Outcome = ({ game }: { game: PlayerSpecialGameDto }) => {
  const predicted = game.myHomeGoals != null;
  const mine = predicted ? `Your score: ${game.myHomeGoals}-${game.myAwayGoals}.` : "You didn't predict this one.";
  if (game.status === "postponed" || game.status === "cancelled")
    return <p className="text-sm text-muted-foreground">This match was {game.status}. {mine}</p>;
  if (game.status !== "ended" || !game.finalScore)
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lock className="h-4 w-4 shrink-0" /> Locked. {mine}
      </p>
    );
  return (
    <div className="space-y-1 text-sm">
      <p className="font-semibold">
        Result: {game.homeTeam} {game.finalScore.home}-{game.finalScore.away} {game.awayTeam}
      </p>
      <p className="text-muted-foreground">{mine}</p>
      {game.myPrizeKobo != null ? (
        <p className="font-semibold text-success">You won {formatNaira(game.myPrizeKobo)}. It's in your wallet.</p>
      ) : game.winners > 0 ? (
        <p className="text-muted-foreground">{game.winners === 1 ? "1 player" : `${game.winners} players`} got it right.</p>
      ) : (
        <p className="text-muted-foreground">Nobody got it right, so the pot isn't paid.</p>
      )}
    </div>
  );
};

const GameCard = ({ game, onSaved }: { game: PlayerSpecialGameDto; onSaved: (games: PlayerSpecialGameDto[]) => void }) => (
  <div className="space-y-4 rounded-xl border border-primary/30 bg-card p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-semibold">
          {game.homeTeam} vs {game.awayTeam}
        </p>
        <p className="text-xs text-muted-foreground">
          {game.competition} · {format(new Date(game.kickoff), "EEE d MMM, h:mm a")}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-lg font-bold tabular-nums text-primary">{formatNaira(game.potKobo)}</p>
        <p className="text-[11px] text-muted-foreground">{game.entries === 1 ? "1 player in" : `${game.entries} players in`}</p>
      </div>
    </div>
    {game.open ? (
      <ScoreForm key={`${game.myHomeGoals}-${game.myAwayGoals}`} game={game} onSaved={onSaved} />
    ) : (
      <Outcome game={game} />
    )}
  </div>
);

const SpecialGames = () => {
  const { currentUser } = useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!currentUser) navigate("/");
  }, [currentUser, navigate]);

  const { data: games, isLoading, error } = useQuery({
    queryKey: KEY,
    queryFn: () => api.specialGames.get(),
    enabled: !!currentUser,
    // Games lock at kickoff and results come in while people watch.
    refetchInterval: 30_000,
  });

  // None, or switched off: the page isn't there (an old link or one left open lands on Predict).
  useEffect(() => {
    if (currentUser && !isLoading && !error && games?.length === 0) navigate("/predict", { replace: true });
  }, [currentUser, isLoading, error, games, navigate]);

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-background pb-8 page-transition">
      <NavBar />
      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-6 sm:px-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Sparkles className="h-6 w-6 text-primary" /> Special games
          </h1>
          <p className="text-sm text-muted-foreground">
            Predict the exact score. Everyone who gets it shares the pot, paid into your wallet. This is separate from your normal
            predictions and doesn't affect the standings.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Couldn't load special games."}
          </p>
        ) : (
          games?.map((g) => <GameCard key={g.fixtureId} game={g} onSaved={(next) => queryClient.setQueryData(KEY, next)} />)
        )}
      </div>
    </div>
  );
};

export default SpecialGames;
