import { describe, it, expect } from "vitest";
import { activeWeek } from "@/lib/weeks";
import type { FixtureStatus, MatchWeekDto } from "@/lib/api";

const week = (id: string, fixtures: [string, FixtureStatus][]): MatchWeekDto => ({
  id,
  name: id,
  competition: "La Liga",
  fixtures: fixtures.map(([kickoff, status], i) => ({
    id: `${id}-${i}`,
    weekId: id,
    homeTeam: "A",
    awayTeam: "B",
    kickoff,
    status,
    finalScore: null,
    liveScore: null,
    liveMinute: null,
  })),
});

const NOW = new Date("2026-10-07T12:00:00Z").getTime();

describe("activeWeek", () => {
  it("picks the week whose next match kicks off soonest", () => {
    const weeks = [
      week("w9", [["2026-10-16T15:00:00Z", "pre_match"]]),
      week("w7", [["2026-10-01T15:00:00Z", "ended"]]),
      week("w8", [["2026-10-09T19:00:00Z", "pre_match"]]),
    ];
    expect(activeWeek(weeks, NOW)?.id).toBe("w8");
  });

  it("ignores stale pre-match fixtures whose kickoff has passed", () => {
    const weeks = [
      week("w6", [["2026-09-16T17:00:00Z", "pre_match"], ["2026-09-15T17:00:00Z", "ended"]]),
      week("w8", [["2026-10-09T19:00:00Z", "pre_match"]]),
    ];
    expect(activeWeek(weeks, NOW)?.id).toBe("w8");
  });

  it("falls back to the latest week when nothing is upcoming", () => {
    const weeks = [
      week("w7", [["2026-10-01T15:00:00Z", "ended"]]),
      week("w6", [["2026-09-20T15:00:00Z", "ended"]]),
    ];
    expect(activeWeek(weeks, NOW)?.id).toBe("w7");
  });
});
