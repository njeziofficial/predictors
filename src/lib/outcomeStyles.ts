import type { OutcomeType } from "./api";

// One colour per outcome, shared by every page that shows a pick, so a player
// learns it once: blue = home win, yellow = draw, purple = away win, orange = score.
// Class strings are written out in full so Tailwind can find them.
export interface OutcomeStyle {
  label: string;
  /** Outline + text, for an unselected-but-tinted control. */
  outline: string;
  /** Filled look for the selected button. */
  solid: string;
  /** Soft pill for showing a saved pick. */
  badge: string;
  /** Small colour key dot on an unselected button. */
  dot: string;
  /** Left accent stripe on a fixture card that has a pick. */
  accent: string;
}

export const OUTCOME_STYLES: Record<OutcomeType, OutcomeStyle> = {
  home_win: {
    label: "Home Win",
    outline: "border-blue-500 text-blue-400",
    solid: "border-blue-500 bg-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.45)]",
    badge: "border-blue-500/50 bg-blue-500/15 text-blue-400",
    dot: "bg-blue-500",
    accent: "border-l-blue-500",
  },
  draw: {
    label: "Draw",
    outline: "border-yellow-500 text-yellow-400",
    solid: "border-yellow-400 bg-yellow-400 text-black shadow-[0_0_12px_rgba(250,204,21,0.45)]",
    badge: "border-yellow-500/50 bg-yellow-500/15 text-yellow-400",
    dot: "bg-yellow-400",
    accent: "border-l-yellow-400",
  },
  away_win: {
    label: "Away Win",
    outline: "border-purple-500 text-purple-400",
    solid: "border-purple-500 bg-purple-500 text-white shadow-[0_0_12px_rgba(168,85,247,0.45)]",
    badge: "border-purple-500/50 bg-purple-500/15 text-purple-400",
    dot: "bg-purple-500",
    accent: "border-l-purple-500",
  },
  correct_score: {
    label: "Score",
    outline: "border-primary text-primary",
    solid: "border-primary bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.45)]",
    badge: "border-primary/50 bg-primary/15 text-primary",
    dot: "bg-primary",
    accent: "border-l-primary",
  },
};

export function outcomeLabel(outcome: OutcomeType, homeGoals?: number | null, awayGoals?: number | null): string {
  if (outcome === "correct_score" && homeGoals != null && awayGoals != null) {
    return `Score ${homeGoals}-${awayGoals}`;
  }
  return OUTCOME_STYLES[outcome].label;
}
