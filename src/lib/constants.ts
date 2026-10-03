import type { OutcomeType } from "./api";

export const POINTS: Record<OutcomeType, number> = {
  home_win: 2,
  away_win: 3,
  draw: 5,
  correct_score: 10,
};
