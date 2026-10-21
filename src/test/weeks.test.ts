import { describe, it, expect } from "vitest";
import { activeWeek, canGoToExtraTime, rescheduledFixtureIds, weekLabel } from "@/lib/weeks";
import type { FixtureStatus, MatchWeekDto } from "@/lib/api";

const week = (id: string, fixtures: [string, FixtureStatus][]): MatchWeekDto => ({
  id,
  name: id,
  competition: "La Liga",
  competitionId: "la-liga",
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

describe("competition weeks", () => {
  it("labels a week without its competition", () => {
    expect(weekLabel({ name: "La Liga — Week 8", competition: "La Liga" })).toBe("Week 8");
    expect(weekLabel({ name: "Champions League — Round of 16 — 1st leg", competition: "Champions League" }))
      .toBe("Round of 16 — 1st leg");
  });

  it("knows which knockout weeks are marked after 90 minutes", () => {
    expect(canGoToExtraTime({ id: "champions-league-r16-leg2" })).toBe(true);
    expect(canGoToExtraTime({ id: "champions-league-final" })).toBe(true);
    expect(canGoToExtraTime({ id: "champions-league-r16-leg1" })).toBe(false);
    expect(canGoToExtraTime({ id: "champions-league-md-3" })).toBe(false);
    expect(canGoToExtraTime({ id: "la-liga-week-8" })).toBe(false);
  });
});

describe("rescheduled matches", () => {
  // Week 6's match against Athletic was postponed and is played after week 9 has started.
  const weeks = [
    week("w6", [["2026-09-20T15:00:00Z", "ended"], ["2026-10-21T19:00:00Z", "pre_match"]]),
    week("w8", [["2026-10-04T15:00:00Z", "ended"], ["2026-10-06T19:00:00Z", "ended"]]),
    week("w9", [["2026-10-17T15:00:00Z", "ended"], ["2026-10-20T19:00:00Z", "ended"]]),
    week("w10", [["2026-10-24T15:00:00Z", "pre_match"], ["2026-10-26T19:00:00Z", "pre_match"]]),
  ];
  const now = new Date("2026-10-21T12:00:00Z").getTime();

  it("are the matches kicking off after the competition's next week has started", () => {
    expect([...rescheduledFixtureIds(weeks)]).toEqual(["w6-1"]);
  });

  it("don't count a week's own late match, like a Monday game", () => {
    expect(rescheduledFixtureIds(weeks).has("w10-1")).toBe(false);
    expect(rescheduledFixtureIds(weeks).has("w9-1")).toBe(false);
  });

  it("only compare weeks of the same competition", () => {
    const cup = { ...week("cl-md3", [["2026-10-01T19:00:00Z", "ended"]]), competitionId: "champions-league" };
    expect(rescheduledFixtureIds([weeks[0], cup]).size).toBe(0);
  });

  it("don't make their old week the current one", () => {
    expect(activeWeek(weeks, now)?.id).toBe("w10");
  });
});
