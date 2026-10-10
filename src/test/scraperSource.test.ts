import { describe, it, expect } from "vitest";
import {
  describeSource,
  moveSource,
  sameSource,
  savedSource,
  sourceError,
  sourceWarnings,
  toggleSource,
  type ScraperSource,
} from "@/lib/scraperSource";
import type { ScraperSettingsDto } from "@/lib/api";

const ROUND_SOURCES = ["Flashscore", "FotMob", "WorldFootball"];

const source = (mode: ScraperSource["mode"], sourceOrder: string[], sourceName = "Flashscore"): ScraperSource => ({
  mode,
  sourceName,
  sourceOrder,
});

describe("savedSource", () => {
  const settings = { sourceName: "Livescore" } as ScraperSettingsDto;

  it("treats a backend without source modes as Single on its source", () => {
    expect(savedSource(settings)).toEqual({ mode: "Single", sourceName: "Livescore", sourceOrder: ["Livescore"] });
  });

  it("reads the mode and order when sent", () => {
    expect(savedSource({ ...settings, sourceMode: "Rotate", sourceOrder: ["Flashscore", "FotMob"] })).toEqual({
      mode: "Rotate",
      sourceName: "Livescore",
      sourceOrder: ["Flashscore", "FotMob"],
    });
  });
});

describe("toggleSource and moveSource", () => {
  it("adds at the end and removes", () => {
    expect(toggleSource(["Flashscore"], "FotMob")).toEqual(["Flashscore", "FotMob"]);
    expect(toggleSource(["Flashscore", "FotMob"], "Flashscore")).toEqual(["FotMob"]);
  });

  it("swaps with the neighbour", () => {
    expect(moveSource(["A", "B", "C"], "C", -1)).toEqual(["A", "C", "B"]);
    expect(moveSource(["A", "B", "C"], "A", 1)).toEqual(["B", "A", "C"]);
  });

  it("does nothing past either end or for a source not in the list", () => {
    const order = ["A", "B"];
    expect(moveSource(order, "A", -1)).toBe(order);
    expect(moveSource(order, "B", 1)).toBe(order);
    expect(moveSource(order, "Z", 1)).toBe(order);
  });
});

describe("sameSource", () => {
  it("compares the order, not just the members", () => {
    expect(sameSource(source("Fallback", ["A", "B"]), source("Fallback", ["A", "B"]))).toBe(true);
    expect(sameSource(source("Fallback", ["A", "B"]), source("Fallback", ["B", "A"]))).toBe(false);
    expect(sameSource(source("Fallback", ["A", "B"]), source("Rotate", ["A", "B"]))).toBe(false);
  });
});

describe("sourceError", () => {
  it("needs two sources to fall back or rotate", () => {
    expect(sourceError(source("Fallback", ["Flashscore"]))).toMatch(/at least 2/);
    expect(sourceError(source("Rotate", []))).toMatch(/rotate through/);
    expect(sourceError(source("Rotate", ["Flashscore", "FotMob"]))).toBeNull();
  });

  it("ignores the list in Single mode", () => {
    expect(sourceError(source("Single", []))).toBeNull();
  });
});

describe("sourceWarnings", () => {
  it("is quiet for a source that reports rounds", () => {
    expect(sourceWarnings(source("Single", [], "FotMob"), ROUND_SOURCES)).toEqual([]);
    expect(sourceWarnings(source("Fallback", ["Flashscore", "Livescore"]), ROUND_SOURCES)).toEqual([]);
  });

  it("warns that a single source without rounds can't add weeks", () => {
    const [warning] = sourceWarnings(source("Single", [], "Livescore"), ROUND_SOURCES);
    expect(warning).toMatch(/^Livescore doesn't report which round/);
  });

  it("warns when no source in the list reports rounds", () => {
    const [warning] = sourceWarnings(source("Fallback", ["Livescore", "ESPN"]), ROUND_SOURCES);
    expect(warning).toMatch(/^None of these/);
  });

  it("says nothing when the backend doesn't say which sources report rounds", () => {
    expect(sourceWarnings(source("Single", [], "Livescore"), [])).toEqual([]);
  });

  it("explains which rotated polls only update scores", () => {
    const [warning] = sourceWarnings(source("Rotate", ["Flashscore", "ESPN"]), ROUND_SOURCES);
    expect(warning).toMatch(/^Polls led by ESPN only update/);
  });
});

describe("describeSource", () => {
  it("says what each mode will do", () => {
    expect(describeSource(source("Single", [], "FotMob"))).toBe("Only FotMob.");
    expect(describeSource(source("Fallback", ["Flashscore", "FotMob"]))).toBe("Flashscore → FotMob, moving on only when one fails.");
    expect(describeSource(source("Rotate", ["Flashscore", "FotMob"]))).toBe("Rotating through Flashscore, FotMob.");
  });
});
