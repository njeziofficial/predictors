import type { ScraperSettingsDto, SourceMode } from "@/lib/api";

/**
 * Which site(s) the live scraper reads, set by the system admin only. The backend's
 * Services/Scraping/SourcePlan.cs decides each poll's sources from this; this mirrors its rules
 * so the admin page only offers what will be accepted.
 */
export interface ScraperSource {
  mode: SourceMode;
  /** The one source Single mode uses. */
  sourceName: string;
  /** Fallback and Rotate: the sources to use, in order. */
  sourceOrder: string[];
}

export const SOURCE_MODES: { value: SourceMode; label: string; help: string }[] = [
  {
    value: "Single",
    label: "One source",
    help: "Only the chosen site is read. If it fails or shows no matches, that poll is skipped and tried again next time.",
  },
  {
    value: "Fallback",
    label: "Fallback",
    help: "The first site is read every poll. The next one is tried only when the one before fails or shows no matches.",
  },
  {
    value: "Rotate",
    label: "Rotate",
    help: "A different site leads each poll, falling back through the rest when one fails. Spreads the load so no single site is hit every poll.",
  },
];

/** At least this many sources for Fallback and Rotate (the backend refuses fewer). */
export const MIN_LIST_SOURCES = 2;

/** The saved choice, defaulting what an older backend doesn't send. */
export function savedSource(settings: ScraperSettingsDto): ScraperSource {
  return {
    mode: settings.sourceMode ?? "Single",
    sourceName: settings.sourceName,
    sourceOrder: settings.sourceOrder ?? [settings.sourceName],
  };
}

export function sameSource(a: ScraperSource, b: ScraperSource): boolean {
  return (
    a.mode === b.mode &&
    a.sourceName === b.sourceName &&
    a.sourceOrder.length === b.sourceOrder.length &&
    a.sourceOrder.every((s, i) => s === b.sourceOrder[i])
  );
}

/** The sources actually used in this mode, in order. */
export function sourcesInUse(source: ScraperSource): string[] {
  return source.mode === "Single" ? [source.sourceName] : source.sourceOrder;
}

/** Adds the source at the end of the list, or takes it out. */
export function toggleSource(order: string[], name: string): string[] {
  return order.includes(name) ? order.filter((s) => s !== name) : [...order, name];
}

/** Moves the source one place earlier (-1) or later (+1); does nothing at either end. */
export function moveSource(order: string[], name: string, by: -1 | 1): string[] {
  const from = order.indexOf(name);
  const to = from + by;
  if (from < 0 || to < 0 || to >= order.length) return order;
  const next = [...order];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** Why this choice can't be saved, or null if it can. */
export function sourceError(source: ScraperSource): string | null {
  if (source.mode !== "Single" && source.sourceOrder.length < MIN_LIST_SOURCES)
    return `Choose at least ${MIN_LIST_SOURCES} sources to ${source.mode === "Rotate" ? "rotate through" : "fall back through"}.`;
  return null;
}

/** Things to know before saving: allowed, but they change what the app can do. */
export function sourceWarnings(source: ScraperSource, roundSources: string[]): string[] {
  if (roundSources.length === 0) return []; // not known (older backend)
  const used = sourcesInUse(source);
  const withoutRounds = used.filter((s) => !roundSources.includes(s));
  const roundList = roundSources.join(", ");

  if (withoutRounds.length === used.length) {
    return [
      `${used.length === 1 ? `${used[0]} doesn't` : "None of these"} report which round a match is in, so new match weeks and fixtures won't be added. Existing fixtures still get scores. Include ${roundList} to keep new weeks appearing.`,
    ];
  }
  if (source.mode === "Rotate" && withoutRounds.length > 0) {
    return [
      `Polls led by ${withoutRounds.join(", ")} only update existing fixtures. New fixtures are added on the polls led by a source that reports rounds.`,
    ];
  }
  return [];
}

/** One line for the confirm dialog and the read-only view. */
export function describeSource(source: ScraperSource): string {
  switch (source.mode) {
    case "Single":
      return `Only ${source.sourceName}.`;
    case "Fallback":
      return `${source.sourceOrder.join(" → ")}, moving on only when one fails.`;
    case "Rotate":
      return `Rotating through ${source.sourceOrder.join(", ")}.`;
  }
}
