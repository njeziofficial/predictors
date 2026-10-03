export interface User {
  id: string;
  name: string;
  email: string;
}

export type MatchStatus = "pre_match" | "live" | "ended";

export interface Match {
  id: string;
  weekId: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: Date;
  status: MatchStatus;
  finalScore?: { home: number; away: number };
}

export interface MatchWeek {
  id: string;
  name: string;
  matches: Match[];
}

export type OutcomeType = "home_win" | "away_win" | "draw" | "correct_score";

export interface Prediction {
  matchId: string;
  outcome: OutcomeType;
  homeGoals?: number;
  awayGoals?: number;
}

export interface PredictionResult extends Prediction {
  actualOutcome?: OutcomeType | "loss";
  pointsEarned: number;
}

export interface WeekHistory {
  weekId: string;
  weekName: string;
  predictions: PredictionResult[];
  totalPoints: number;
  submittedAt: Date;
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  points: number;
  submittedAt: Date;
}

export const POINTS: Record<OutcomeType | "loss", number> = {
  home_win: 2,
  away_win: 3,
  draw: 5,
  correct_score: 10,
  loss: 0,
};

export const dummyUsers: User[] = [
  { id: "u1", name: "Adebayo Ogunlesi", email: "adebayo@demo.com" },
  { id: "u2", name: "Blessing Nwachukwu", email: "blessing@demo.com" },
  { id: "u3", name: "Chidi Okafor", email: "chidi@demo.com" },
  { id: "u4", name: "Damilola Ade", email: "dami@demo.com" },
  { id: "u5", name: "Emeka Uzor", email: "emeka@demo.com" },
  { id: "u6", name: "Fatima Bello", email: "fatima@demo.com" },
  { id: "u7", name: "George Mensah", email: "george@demo.com" },
  { id: "u8", name: "Halima Yusuf", email: "halima@demo.com" },
  { id: "u9", name: "Ibrahim Sule", email: "ibrahim@demo.com" },
  { id: "u10", name: "Janet Osei", email: "janet@demo.com" },
  { id: "u11", name: "Kofi Asante", email: "kofi@demo.com" },
  { id: "u12", name: "Lola Bakare", email: "lola@demo.com" },
  { id: "u13", name: "Musa Abdullahi", email: "musa@demo.com" },
  { id: "u14", name: "Ngozi Eze", email: "ngozi@demo.com" },
  { id: "u15", name: "Oluwaseun Martins", email: "seun@demo.com" },
  { id: "u16", name: "Patricia Owusu", email: "patricia@demo.com" },
  { id: "u17", name: "Rasheed Lawal", email: "rasheed@demo.com" },
  { id: "u18", name: "Sandra Ojo", email: "sandra@demo.com" },
  { id: "u19", name: "Tunde Afolabi", email: "tunde@demo.com" },
  { id: "u20", name: "Uche Nnamdi", email: "uche@demo.com" },
];

// Helper: create dates relative to now for easy testing
const now = new Date();
const hours = (h: number) => new Date(now.getTime() + h * 3600000);
const days = (d: number, h = 0) => new Date(now.getTime() + (d * 24 + h) * 3600000);
const mins = (m: number) => new Date(now.getTime() + m * 60000);

// ── 3 ended weeks + 1 current (open) week ──

export const dummyMatchWeeks: MatchWeek[] = [
  // Week 28 — ended 2 weeks ago
  {
    id: "w1",
    name: "La Liga — Week 28",
    matches: [
      { id: "m1", weekId: "w1", homeTeam: "Real Madrid", awayTeam: "Barcelona", kickoff: days(-14, 0), status: "ended", finalScore: { home: 1, away: 2 } },
      { id: "m2", weekId: "w1", homeTeam: "Sevilla", awayTeam: "Atlético Madrid", kickoff: days(-14, 2), status: "ended", finalScore: { home: 1, away: 1 } },
      { id: "m3", weekId: "w1", homeTeam: "Athletic Bilbao", awayTeam: "Valencia", kickoff: days(-14, 4), status: "ended", finalScore: { home: 2, away: 0 } },
      { id: "m4", weekId: "w1", homeTeam: "Villarreal", awayTeam: "Real Sociedad", kickoff: days(-13, 0), status: "ended", finalScore: { home: 2, away: 2 } },
      { id: "m5", weekId: "w1", homeTeam: "Getafe", awayTeam: "Osasuna", kickoff: days(-13, 2), status: "ended", finalScore: { home: 0, away: 1 } },
      { id: "m6", weekId: "w1", homeTeam: "Real Betis", awayTeam: "Girona", kickoff: days(-13, 4), status: "ended", finalScore: { home: 3, away: 1 } },
      { id: "m7", weekId: "w1", homeTeam: "Celta Vigo", awayTeam: "Mallorca", kickoff: days(-13, 6), status: "ended", finalScore: { home: 2, away: 2 } },
      { id: "m8", weekId: "w1", homeTeam: "Rayo Vallecano", awayTeam: "Cádiz", kickoff: days(-12, 0), status: "ended", finalScore: { home: 0, away: 1 } },
      { id: "m9", weekId: "w1", homeTeam: "Espanyol", awayTeam: "Las Palmas", kickoff: days(-12, 2), status: "ended", finalScore: { home: 1, away: 0 } },
      { id: "m10", weekId: "w1", homeTeam: "Leganés", awayTeam: "Alavés", kickoff: days(-12, 4), status: "ended", finalScore: { home: 1, away: 1 } },
    ],
  },
  // Week 29 — ended 1 week ago
  {
    id: "w2",
    name: "La Liga — Week 29",
    matches: [
      { id: "m11", weekId: "w2", homeTeam: "Barcelona", awayTeam: "Sevilla", kickoff: days(-7, 0), status: "ended", finalScore: { home: 3, away: 0 } },
      { id: "m12", weekId: "w2", homeTeam: "Atlético Madrid", awayTeam: "Real Madrid", kickoff: days(-7, 2), status: "ended", finalScore: { home: 1, away: 1 } },
      { id: "m13", weekId: "w2", homeTeam: "Valencia", awayTeam: "Villarreal", kickoff: days(-7, 4), status: "ended", finalScore: { home: 0, away: 2 } },
      { id: "m14", weekId: "w2", homeTeam: "Real Sociedad", awayTeam: "Getafe", kickoff: days(-6, 0), status: "ended", finalScore: { home: 2, away: 1 } },
      { id: "m15", weekId: "w2", homeTeam: "Osasuna", awayTeam: "Athletic Bilbao", kickoff: days(-6, 2), status: "ended", finalScore: { home: 1, away: 3 } },
      { id: "m16", weekId: "w2", homeTeam: "Girona", awayTeam: "Celta Vigo", kickoff: days(-6, 4), status: "ended", finalScore: { home: 2, away: 0 } },
      { id: "m17", weekId: "w2", homeTeam: "Mallorca", awayTeam: "Real Betis", kickoff: days(-6, 6), status: "ended", finalScore: { home: 1, away: 1 } },
      { id: "m18", weekId: "w2", homeTeam: "Cádiz", awayTeam: "Espanyol", kickoff: days(-5, 0), status: "ended", finalScore: { home: 0, away: 0 } },
      { id: "m19", weekId: "w2", homeTeam: "Las Palmas", awayTeam: "Leganés", kickoff: days(-5, 2), status: "ended", finalScore: { home: 2, away: 1 } },
      { id: "m20", weekId: "w2", homeTeam: "Alavés", awayTeam: "Rayo Vallecano", kickoff: days(-5, 4), status: "ended", finalScore: { home: 1, away: 0 } },
    ],
  },
  // Week 30 — ended 3 days ago
  {
    id: "w3",
    name: "La Liga — Week 30",
    matches: [
      { id: "m21", weekId: "w3", homeTeam: "Real Madrid", awayTeam: "Atlético Madrid", kickoff: days(-3, 0), status: "ended", finalScore: { home: 2, away: 1 } },
      { id: "m22", weekId: "w3", homeTeam: "Sevilla", awayTeam: "Valencia", kickoff: days(-3, 2), status: "ended", finalScore: { home: 0, away: 0 } },
      { id: "m23", weekId: "w3", homeTeam: "Barcelona", awayTeam: "Athletic Bilbao", kickoff: days(-3, 4), status: "ended", finalScore: { home: 4, away: 1 } },
      { id: "m24", weekId: "w3", homeTeam: "Villarreal", awayTeam: "Osasuna", kickoff: days(-2, 0), status: "ended", finalScore: { home: 1, away: 0 } },
      { id: "m25", weekId: "w3", homeTeam: "Real Sociedad", awayTeam: "Girona", kickoff: days(-2, 2), status: "ended", finalScore: { home: 2, away: 2 } },
      { id: "m26", weekId: "w3", homeTeam: "Getafe", awayTeam: "Mallorca", kickoff: days(-2, 4), status: "ended", finalScore: { home: 1, away: 0 } },
      { id: "m27", weekId: "w3", homeTeam: "Celta Vigo", awayTeam: "Cádiz", kickoff: days(-2, 6), status: "ended", finalScore: { home: 3, away: 0 } },
      { id: "m28", weekId: "w3", homeTeam: "Real Betis", awayTeam: "Las Palmas", kickoff: days(-1, 0), status: "ended", finalScore: { home: 2, away: 1 } },
      { id: "m29", weekId: "w3", homeTeam: "Espanyol", awayTeam: "Alavés", kickoff: days(-1, 2), status: "ended", finalScore: { home: 1, away: 1 } },
      { id: "m30", weekId: "w3", homeTeam: "Rayo Vallecano", awayTeam: "Leganés", kickoff: days(-1, 4), status: "ended", finalScore: { home: 0, away: 2 } },
    ],
  },
  // Week 31 — CURRENT WEEK (mix of ended, live, and pre_match for immediate testing)
  {
    id: "w4",
    name: "La Liga — Week 31",
    matches: [
      // Already ended — testers see results immediately
      { id: "m31", weekId: "w4", homeTeam: "Barcelona", awayTeam: "Real Madrid", kickoff: days(-2, 0), status: "ended", finalScore: { home: 2, away: 1 } },
      { id: "m32", weekId: "w4", homeTeam: "Atlético Madrid", awayTeam: "Sevilla", kickoff: days(-2, 2), status: "ended", finalScore: { home: 1, away: 1 } },
      { id: "m33", weekId: "w4", homeTeam: "Athletic Bilbao", awayTeam: "Villarreal", kickoff: days(-2, 4), status: "ended", finalScore: { home: 0, away: 2 } },
      { id: "m34", weekId: "w4", homeTeam: "Valencia", awayTeam: "Real Sociedad", kickoff: days(-1, 0), status: "ended", finalScore: { home: 3, away: 0 } },
      // Currently LIVE — kicked off recently so getLiveMatchStatus computes "live"
      { id: "m35", weekId: "w4", homeTeam: "Osasuna", awayTeam: "Getafe", kickoff: mins(-1), status: "pre_match", finalScore: undefined },
      { id: "m36", weekId: "w4", homeTeam: "Girona", awayTeam: "Celta Vigo", kickoff: mins(-2), status: "pre_match", finalScore: undefined },
      // Upcoming — pre_match
      { id: "m37", weekId: "w4", homeTeam: "Mallorca", awayTeam: "Real Betis", kickoff: hours(3), status: "pre_match", finalScore: undefined },
      { id: "m38", weekId: "w4", homeTeam: "Cádiz", awayTeam: "Espanyol", kickoff: days(1, 2), status: "pre_match", finalScore: undefined },
      { id: "m39", weekId: "w4", homeTeam: "Las Palmas", awayTeam: "Rayo Vallecano", kickoff: days(2, 4), status: "pre_match", finalScore: undefined },
      { id: "m40", weekId: "w4", homeTeam: "Leganés", awayTeam: "Alavés", kickoff: days(3, 2), status: "pre_match", finalScore: undefined },
    ],
  },
];

// Flatten all matches sorted by kickoff
export const allMatchesSorted = dummyMatchWeeks
  .flatMap((w) => w.matches)
  .sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());

// Check if a week is locked (30 seconds before first match)
export const isWeekLocked = (week: MatchWeek): boolean => {
  const earliest = week.matches.reduce((min, m) => (m.kickoff < min.kickoff ? m : min), week.matches[0]);
  const lockTime = new Date(earliest.kickoff.getTime() - 30 * 1000); // 30 seconds before
  return new Date() >= lockTime;
};

// Compute live match status dynamically based on current time
// A match is "live" once kickoff has passed (until 90 mins after), then "ended"
const MATCH_DURATION_MS = 3 * 60 * 1000; // 3 minutes for testing (simulates 90 min match)

export const getLiveMatchStatus = (match: Match): MatchStatus => {
  // Past weeks are already ended
  if (match.status === "ended") return "ended";
  const now = new Date();
  const kickoff = match.kickoff.getTime();
  if (now.getTime() >= kickoff + MATCH_DURATION_MS) return "ended";
  if (now.getTime() >= kickoff) return "live";
  return "pre_match";
};

// Get simulated live score based on elapsed time
export const getLiveScore = (match: Match): { home: number; away: number } | undefined => {
  if (match.finalScore) return match.finalScore;
  const status = getLiveMatchStatus(match);
  if (status === "pre_match") return undefined;
  const elapsed = (Date.now() - match.kickoff.getTime()) / 1000;
  const progress = Math.min(elapsed / (MATCH_DURATION_MS / 1000), 1);
  // Deterministic score based on match id
  const seed = parseInt(match.id.replace(/\D/g, ""), 10);
  const homeGoals = Math.floor(progress * ((seed % 3) + 1));
  const awayGoals = Math.floor(progress * ((seed % 2) + 1));
  return { home: homeGoals, away: awayGoals };
};

// Get simulated match minute
export const getLiveMinute = (match: Match): number => {
  const elapsed = Math.max(0, Date.now() - match.kickoff.getTime()) / 1000;
  return Math.min(90, Math.floor((elapsed / (MATCH_DURATION_MS / 1000)) * 90));
};

// Determine actual outcome from final score
export const getActualOutcome = (match: Match): OutcomeType | "loss" | null => {
  const status = getLiveMatchStatus(match);
  const score = getLiveScore(match);
  if (status !== "ended" || !score) return null;
  const { home, away } = score;
  if (home > away) return "home_win";
  if (away > home) return "away_win";
  return "draw";
};

// Score a prediction against a match result
export const scorePrediction = (prediction: Prediction, match: Match): number => {
  const status = getLiveMatchStatus(match);
  const score = getLiveScore(match);
  if (status !== "ended" || !score) return 0;
  const actual = getActualOutcome(match);

  if (prediction.outcome === "correct_score") {
    if (
      prediction.homeGoals === score.home &&
      prediction.awayGoals === score.away
    ) {
      return POINTS.correct_score;
    }
    const predictedDirection =
      (prediction.homeGoals ?? 0) > (prediction.awayGoals ?? 0) ? "home_win" :
      (prediction.awayGoals ?? 0) > (prediction.homeGoals ?? 0) ? "away_win" : "draw";
    if (predictedDirection === actual) {
      return POINTS[predictedDirection];
    }
    return 0;
  }

  if (prediction.outcome === actual) return POINTS[prediction.outcome];
  return 0;
};

// Seeded random for consistent dummy data
const seededRandom = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
};

// Generate history for ALL ended weeks for all users
const generateAllHistory = (): Map<string, WeekHistory[]> => {
  const endedWeeks = dummyMatchWeeks.filter((w) => w.matches.every((m) => m.status === "ended"));
  const map = new Map<string, WeekHistory[]>();

  dummyUsers.forEach((user, userIdx) => {
    const histories: WeekHistory[] = [];
    
    endedWeeks.forEach((week, weekIdx) => {
      const rand = seededRandom(userIdx * 100 + weekIdx * 7 + 42);
      const outcomes: OutcomeType[] = ["home_win", "away_win", "draw", "correct_score"];
      
      const predictions: PredictionResult[] = week.matches.map((match) => {
        const r = rand();
        // Give some users better accuracy for variety
        const useActual = r < (0.3 + userIdx * 0.02);
        const actual = getActualOutcome(match);
        
        let chosenOutcome: OutcomeType;
        if (useActual && actual && actual !== "loss") {
          chosenOutcome = actual;
        } else {
          chosenOutcome = outcomes[Math.floor(rand() * outcomes.length)];
        }
        
        const pred: Prediction = {
          matchId: match.id,
          outcome: chosenOutcome,
          homeGoals: chosenOutcome === "correct_score" ? Math.floor(rand() * 4) : undefined,
          awayGoals: chosenOutcome === "correct_score" ? Math.floor(rand() * 4) : undefined,
        };
        const pts = scorePrediction(pred, match);
        return { ...pred, actualOutcome: pts > 0 ? pred.outcome : "loss", pointsEarned: pts };
      });

      const total = predictions.reduce((s, p) => s + p.pointsEarned, 0);
      histories.push({
        weekId: week.id,
        weekName: week.name,
        predictions,
        totalPoints: total,
        submittedAt: new Date(week.matches[0].kickoff.getTime() - (3600000 * (20 - userIdx))),
      });
    });

    map.set(user.id, histories);
  });

  return map;
};

export const allUserHistories = generateAllHistory();

// For backward compat — flattened single-history map (userId -> first WeekHistory)
export const dummyWeek1History = new Map<string, WeekHistory>();
allUserHistories.forEach((histories, userId) => {
  if (histories.length > 0) dummyWeek1History.set(userId, histories[0]);
});

// Overall leaderboard: sum of all weeks
export const dummyLeaderboard: LeaderboardEntry[] = dummyUsers
  .map((u) => {
    const histories = allUserHistories.get(u.id) || [];
    const totalPts = histories.reduce((s, h) => s + h.totalPoints, 0);
    const latestSubmit = histories.length > 0 ? histories[histories.length - 1].submittedAt : new Date();
    return {
      userId: u.id,
      name: u.name,
      points: totalPts,
      submittedAt: latestSubmit,
    };
  })
  .sort((a, b) => b.points - a.points || a.submittedAt.getTime() - b.submittedAt.getTime());

// Generate week rankings for any ended week
export const getWeekRankings = (weekId: string): { userId: string; name: string; points: number; position: number }[] => {
  const entries = dummyUsers.map((u) => {
    const histories = allUserHistories.get(u.id) || [];
    const weekHist = histories.find((h) => h.weekId === weekId);
    return {
      userId: u.id,
      name: u.name,
      points: weekHist?.totalPoints ?? 0,
      submittedAt: weekHist?.submittedAt ?? new Date(),
    };
  });
  entries.sort((a, b) => b.points - a.points || a.submittedAt.getTime() - b.submittedAt.getTime());
  return entries.map((e, i) => ({ userId: e.userId, name: e.name, points: e.points, position: i + 1 }));
};
