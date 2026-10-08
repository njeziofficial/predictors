import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { hasMatchesInPlay, invalidateLiveAreas } from "@/lib/liveData";

const seeded = () => {
  const qc = new QueryClient();
  for (const key of [
    ["weeks"],
    ["leaderboard"],
    ["leaderboard", "week", "w1"],
    ["predictions", "all"],
    ["predictions-lock-status"],
    ["profile"],
    ["chat", "conversations"],
  ])
    qc.setQueryData(key, "x");
  return qc;
};

const stale = (qc: QueryClient) =>
  qc
    .getQueryCache()
    .getAll()
    .filter((q) => q.state.isInvalidated)
    .map((q) => JSON.stringify(q.queryKey))
    .sort();

describe("invalidateLiveAreas", () => {
  it("marks every query built from a changed area, including nested keys", () => {
    const qc = seeded();
    invalidateLiveAreas(qc, ["leaderboard"]);
    expect(stale(qc)).toEqual(
      ['["leaderboard","week","w1"]', '["leaderboard"]', '["predictions","all"]'].sort(),
    );
  });

  it("leaves per-user and chat data alone", () => {
    const qc = seeded();
    invalidateLiveAreas(qc, ["fixtures", "leaderboard", "settings"]);
    const keys = stale(qc);
    expect(keys).not.toContain('["profile"]');
    expect(keys).not.toContain('["chat","conversations"]');
    expect(keys).toContain('["predictions-lock-status"]');
    expect(keys).toContain('["weeks"]');
  });

  it("ignores areas it doesn't know", () => {
    const qc = seeded();
    invalidateLiveAreas(qc, ["something-new"]);
    expect(stale(qc)).toEqual([]);
  });
});

describe("hasMatchesInPlay", () => {
  it("is true only while a fixture is live", () => {
    expect(hasMatchesInPlay([{ fixtures: [{ status: "pre_match" }, { status: "live" }] }])).toBe(true);
    expect(hasMatchesInPlay([{ fixtures: [{ status: "ended" }] }])).toBe(false);
    expect(hasMatchesInPlay(undefined)).toBe(false);
  });
});
