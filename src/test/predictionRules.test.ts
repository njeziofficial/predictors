import { describe, it, expect } from "vitest";
import { DEFAULT_PREDICTION_RULES, weekPredictionState, type PredictionRules } from "@/lib/predictionRules";
import type { FixtureDto, FixtureStatus } from "@/lib/api";

const fixture = (id: string, kickoff: string, status: FixtureStatus = "pre_match"): FixtureDto => ({
  id,
  weekId: "w",
  homeTeam: "A",
  awayTeam: "B",
  kickoff,
  status,
  finalScore: null,
  liveScore: null,
  liveMinute: null,
});

const NOW = new Date("2026-10-09T18:00:00Z");
// First match has kicked off; the other two haven't.
const startedWeek = [
  fixture("f1", "2026-10-09T17:00:00Z", "live"),
  fixture("f2", "2026-10-09T20:00:00Z"),
  fixture("f3", "2026-10-10T15:00:00Z"),
];
const notStartedWeek = [fixture("f1", "2026-10-09T19:00:00Z"), fixture("f2", "2026-10-09T21:00:00Z")];

const rules = (r: Partial<PredictionRules>): PredictionRules => ({ ...DEFAULT_PREDICTION_RULES, ...r });
const none = new Set<string>();

describe("weekPredictionState", () => {
  it("by default locks each match at its own kickoff", () => {
    const s = weekPredictionState(startedWeek, new Set(["f1", "f2"]), DEFAULT_PREDICTION_RULES, false, NOW);
    expect(s.lockReason).toBeNull();
    expect([...s.editableIds]).toEqual(["f2", "f3"]);
    expect(s.nextLockIsWeek).toBe(false);
  });

  it("treats a match within 30 seconds of kickoff as closed even before the scraper marks it live", () => {
    const s = weekPredictionState(
      [fixture("f1", "2026-10-09T18:00:20Z"), fixture("f2", "2026-10-09T20:00:00Z")],
      none,
      DEFAULT_PREDICTION_RULES,
      false,
      NOW,
    );
    expect([...s.editableIds]).toEqual(["f2"]);
  });

  it("locks the whole week at the first kickoff when that rule is on", () => {
    const s = weekPredictionState(startedWeek, new Set(["f1"]), rules({ lockWeekAtFirstKickoff: true }), false, NOW);
    expect(s.lockReason).toBe("week_started");
    expect(s.editableIds.size).toBe(0);
  });

  it("counts down to the week lock before the first kickoff", () => {
    const s = weekPredictionState(notStartedWeek, none, rules({ lockWeekAtFirstKickoff: true }), false, NOW);
    expect(s.lockReason).toBeNull();
    expect(s.nextLockIsWeek).toBe(true);
    expect(s.nextLockAt?.toISOString()).toBe("2026-10-09T18:59:30.000Z");
  });

  it("lets a player with no predictions predict the remaining matches when late predictions are allowed", () => {
    const r = rules({ lockWeekAtFirstKickoff: true, allowLatePredictions: true });
    const late = weekPredictionState(startedWeek, none, r, false, NOW);
    expect(late.lateEntry).toBe(true);
    expect([...late.editableIds]).toEqual(["f2", "f3"]);

    const alreadyPredicted = weekPredictionState(startedWeek, new Set(["f2"]), r, false, NOW);
    expect(alreadyPredicted.lockReason).toBe("week_started");
  });

  it("keeps submitted predictions read-only when predictions are final", () => {
    const s = weekPredictionState(notStartedWeek, new Set(["f1"]), rules({ predictionsFinal: true }), false, NOW);
    expect([...s.editableIds]).toEqual(["f2"]);
    expect(s.openFixtures.map((f) => f.id)).toEqual(["f1", "f2"]);
  });

  it("locks everything while an admin has predictions locked", () => {
    const s = weekPredictionState(notStartedWeek, none, DEFAULT_PREDICTION_RULES, true, NOW);
    expect(s.lockReason).toBe("admin");
    expect(s.editableIds.size).toBe(0);
  });

  it("ignores postponed matches when deciding whether the week has started", () => {
    const s = weekPredictionState(
      [fixture("p", "2026-10-08T15:00:00Z", "postponed"), ...notStartedWeek],
      none,
      rules({ lockWeekAtFirstKickoff: true }),
      false,
      NOW,
    );
    expect(s.lockReason).toBeNull();
  });
});
