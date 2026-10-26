import { describe, it, expect } from "vitest";
import { standingsThrough } from "@/lib/standings";
import type { LeaderboardEntryDto } from "@/lib/api";

const entry = (
  userId: string,
  totalPoints: number,
  correctScores = 0,
  lastSubmittedAt: string | null = null,
  previousPoints = 0,
): LeaderboardEntryDto => ({
  userId,
  name: userId,
  whatsAppName: null,
  totalPoints,
  previousPoints,
  correctScores,
  position: 0,
  lastSubmittedAt,
});

describe("standingsThrough", () => {
  // Week 1: Ada 5, Ben 3. Week 2: Ben 9, Ada 0. Ada carried 4 points and 1 correct score over.
  const week1 = [entry("ada", 5, 1, "2026-10-01T10:00:00Z"), entry("ben", 3, 0, "2026-10-01T09:00:00Z")];
  const week2 = [entry("ben", 9, 3, "2026-10-08T09:00:00Z"), entry("ada", 0, 0, "2026-10-08T10:00:00Z")];
  const overall = [entry("ben", 12, 3, "2026-10-08T09:00:00Z"), entry("ada", 9, 2, "2026-10-08T10:00:00Z", 4)];

  it("ranks the table as it stood after an earlier week", () => {
    const after1 = standingsThrough(overall, [week1, week2], 1);
    expect(after1.map((e) => [e.userId, e.totalPoints, e.correctScores, e.position])).toEqual([
      ["ada", 9, 2, 1],
      ["ben", 3, 0, 2],
    ]);
    expect(after1[0].lastSubmittedAt).toBe("2026-10-01T10:00:00.000Z");
    expect(after1[0].previousPoints).toBe(4);
  });

  it("matches the season table after the latest week", () => {
    const after2 = standingsThrough(overall, [week1, week2], 2);
    expect(after2.map((e) => [e.userId, e.totalPoints, e.correctScores, e.position])).toEqual([
      ["ben", 12, 3, 1],
      ["ada", 9, 2, 2],
    ]);
  });

  it("breaks a tie on correct scores, then the earlier submission, never-submitted last", () => {
    const week = [
      entry("late", 3, 1, "2026-10-01T12:00:00Z"),
      entry("none", 3, 1, null),
      entry("early", 3, 1, "2026-10-01T08:00:00Z"),
      entry("fewer", 3, 0, "2026-10-01T07:00:00Z"),
    ];
    const season = week.map((e) => ({ ...e }));
    expect(standingsThrough(season, [week], 1).map((e) => e.userId)).toEqual(["early", "late", "none", "fewer"]);
  });
});
