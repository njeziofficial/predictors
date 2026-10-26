import { CircleCheck } from "lucide-react";
import type { BallonDorDto } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatNaira } from "@/lib/wallet";

/** Everyone's picks, with each place marked right once the result is in, and who won what. */
const BallonDorBoard = ({ game, me }: { game: BallonDorDto; me?: string }) => {
  const board = game.board ?? [];
  if (board.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Nobody picked.</p>;
  }
  return (
    <ul className="divide-y divide-border">
      {board.map((e) => (
        <li key={e.userId} className={cn("py-3", e.userId === me && "rounded-lg bg-primary/5 px-2")}>
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-semibold">
              {e.name}
              {e.userId === me && <span className="font-normal text-muted-foreground"> (you)</span>}
            </p>
            {game.result && (
              <span className={cn("shrink-0 text-sm font-semibold tabular-nums", e.prizeKobo > 0 ? "text-success" : "text-muted-foreground")}>
                {e.prizeKobo > 0 ? formatNaira(e.prizeKobo) : `${e.correctPlaces}/5`}
              </span>
            )}
          </div>
          <ol className="mt-1.5 flex flex-wrap gap-1.5">
            {e.picks.map((p, i) => {
              const right = game.result?.[i] === p;
              return (
                <li
                  key={p}
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
                    right ? "border-success/50 bg-success/10 text-success" : "border-border text-muted-foreground",
                  )}
                >
                  <span className="font-semibold tabular-nums">{i + 1}</span> {p}
                  {right && <CircleCheck className="h-3 w-3" />}
                </li>
              );
            })}
          </ol>
          {(e.calledWinner || e.calledTopFive) && (
            <p className="mt-1 text-[11px] font-medium text-success">
              {[e.calledWinner && "Called the winner", e.calledTopFive && "Perfect top 5"].filter(Boolean).join(" · ")}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
};

export default BallonDorBoard;
