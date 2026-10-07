import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Trophy } from "lucide-react";
import { api } from "@/lib/api";

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/** The signed-in player's season position and points (previous points included), linking to the full table. */
const MyStanding = ({ userId }: { userId: string }) => {
  const navigate = useNavigate();
  const { data: board = [] } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: api.leaderboard.overall,
  });

  const me = board.find(e => e.userId === userId);
  if (!me) return null;

  const above = board[me.position - 2];
  const status =
    me.position === 1
      ? board[1]
        ? `Leading by ${me.totalPoints - board[1].totalPoints} pts`
        : "Top of the table"
      : me.totalPoints === above.totalPoints
        ? `Level on points with ${above.name.split(" ")[0]}`
        : `${above.totalPoints - me.totalPoints} pts behind ${me.position - 1 === 1 ? "the leader" : ordinal(me.position - 1)}`;

  return (
    <button
      onClick={() => navigate("/leaderboard")}
      className="group flex w-full items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/40"
    >
      <div
        className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg ${
          me.position <= 3 ? "bg-primary/15 text-primary" : "bg-secondary text-foreground"
        }`}
      >
        {me.position === 1 ? <Trophy className="h-5 w-5" /> : <span className="text-lg font-bold leading-none">{me.position}</span>}
        <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wide opacity-70">
          {me.position === 1 ? "1st" : ordinal(me.position).slice(-2)}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Your season standing</p>
        <p className="text-sm font-semibold">
          {ordinal(me.position)} of {board.length}
          <span className="mx-1.5 text-muted-foreground">·</span>
          {me.totalPoints} pts
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {status}
          {me.correctScores > 0 && ` · ${me.correctScores} correct score${me.correctScores === 1 ? "" : "s"}`}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );
};

export default MyStanding;
