import { describe, it, expect } from "vitest";
import { fixtureDisplay, fixtureStatusText } from "@/lib/fixtureStatus";
import type { FixtureDto } from "@/lib/api";

const NOW = new Date("2026-10-10T16:00:00Z");

const fixture = (f: Partial<FixtureDto>): FixtureDto => ({
  id: "f",
  weekId: "w",
  homeTeam: "Rayo Vallecano",
  awayTeam: "Athletic Club",
  kickoff: "2026-10-10T13:00:00Z",
  status: "pre_match",
  finalScore: null,
  liveScore: null,
  liveMinute: null,
  ...f,
});

describe("fixtureDisplay", () => {
  it("hides a stale score on a postponed match", () => {
    const d = fixtureDisplay(fixture({ status: "postponed", liveScore: { home: 0, away: 0 } }), NOW);
    expect(d).toEqual({ state: "postponed", score: null, label: "Postponed" });
  });

  it("hides a stale score on a cancelled match", () => {
    const d = fixtureDisplay(fixture({ status: "cancelled", finalScore: { home: 0, away: 0 } }), NOW);
    expect(d).toEqual({ state: "cancelled", score: null, label: "Cancelled" });
  });

  it("shows the live score and minute", () => {
    const d = fixtureDisplay(fixture({ status: "live", liveScore: { home: 1, away: 0 }, liveMinute: 67 }), NOW);
    expect(d).toEqual({ state: "live", score: { home: 1, away: 0 }, label: "Live 67'" });
  });

  it("marks a finished match FT, and says when the result isn't in yet", () => {
    expect(fixtureDisplay(fixture({ status: "ended", finalScore: { home: 2, away: 1 } }), NOW).label).toBe("FT");
    expect(fixtureDisplay(fixture({ status: "ended" }), NOW)).toEqual({
      state: "full_time",
      score: null,
      label: "FT · result pending",
    });
  });

  it("tells an upcoming match from one past kickoff with no update yet", () => {
    expect(fixtureDisplay(fixture({ kickoff: "2026-10-10T19:00:00Z" }), NOW).state).toBe("upcoming");
    expect(fixtureDisplay(fixture({}), NOW).label).toBe("Awaiting kick-off");
  });
});

describe("fixtureStatusText", () => {
  it("combines the label and score", () => {
    expect(fixtureStatusText(fixture({ status: "ended", finalScore: { home: 2, away: 1 } }), NOW)).toBe("FT 2-1");
    expect(fixtureStatusText(fixture({ status: "postponed", liveScore: { home: 0, away: 0 } }), NOW)).toBe("Postponed");
    expect(fixtureStatusText(fixture({ kickoff: "2026-10-10T19:00:00Z" }), NOW)).toBe("");
  });
});
