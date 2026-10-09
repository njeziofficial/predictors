import type { FixtureDto } from "@/lib/api";

/**
 * How players may predict, set by the system admin (or admins given "Change prediction rules").
 * The backend enforces all of these in PredictionsController.Submit; this mirrors them so the
 * page only offers what will be accepted.
 */
export interface PredictionRules {
  /** Off: every match still open must be predicted. On: any subset may be submitted. */
  allowPartialPredictions: boolean;
  /** On: a submitted prediction can never be changed. Skipped open matches can still be added. */
  predictionsFinal: boolean;
  /** On: the whole week locks when its first match kicks off. Off: each match locks at its own kickoff. */
  lockWeekAtFirstKickoff: boolean;
  /** With lockWeekAtFirstKickoff: players who hadn't predicted may still predict matches yet to start. */
  allowLatePredictions: boolean;
}

export const DEFAULT_PREDICTION_RULES: PredictionRules = {
  allowPartialPredictions: false,
  predictionsFinal: false,
  lockWeekAtFirstKickoff: false,
  allowLatePredictions: false,
};

/** A match stops taking predictions this long before kickoff (same as the backend). */
export const KICKOFF_LOCK_LEAD_MS = 30_000;

const isPlayable = (f: FixtureDto) => f.status !== "postponed" && f.status !== "cancelled";

export const fixtureLockTime = (f: FixtureDto) => new Date(new Date(f.kickoff).getTime() - KICKOFF_LOCK_LEAD_MS);

/** Still taking predictions: not started, and not within the lock lead of kickoff. */
export const isFixtureOpen = (f: FixtureDto, now: Date) => f.status === "pre_match" && now < fixtureLockTime(f);

/** Any match of the week has kicked off (or is within the lock lead of it). */
export const hasWeekStarted = (fixtures: FixtureDto[], now: Date) =>
  fixtures.some((f) => isPlayable(f) && (f.status !== "pre_match" || now >= fixtureLockTime(f)));

export type WeekLockReason = "admin" | "week_started" | "all_started";

export interface WeekPredictionState {
  /** Why this player can't submit anything for the week, or null when they can. */
  lockReason: WeekLockReason | null;
  /** The week locked at its first kickoff, but this player hadn't predicted, so may still. */
  lateEntry: boolean;
  /** Matches still taking predictions (whether or not this player may still change them). */
  openFixtures: FixtureDto[];
  /** Matches this player may pick or change right now. */
  editableIds: Set<string>;
  /** When the next lock happens, for the countdown; null when nothing is left to lock. */
  nextLockAt: Date | null;
  /** That next lock closes the whole week, not just one match. */
  nextLockIsWeek: boolean;
}

/**
 * What a player may do with a week right now. savedFixtureIds are the matches they have already
 * submitted predictions for in this week.
 */
export function weekPredictionState(
  fixtures: FixtureDto[],
  savedFixtureIds: ReadonlySet<string>,
  rules: PredictionRules,
  adminLocked: boolean,
  now: Date,
): WeekPredictionState {
  const openFixtures = fixtures
    .filter((f) => isFixtureOpen(f, now))
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
  const started = hasWeekStarted(fixtures, now);
  const lateEntry =
    rules.lockWeekAtFirstKickoff && started && rules.allowLatePredictions && savedFixtureIds.size === 0;

  const lockReason: WeekLockReason | null = adminLocked
    ? "admin"
    : rules.lockWeekAtFirstKickoff && started && !lateEntry
      ? "week_started"
      : openFixtures.length === 0
        ? "all_started"
        : null;

  const editableIds = new Set(
    lockReason
      ? []
      : openFixtures.filter((f) => !(rules.predictionsFinal && savedFixtureIds.has(f.id))).map((f) => f.id),
  );

  return {
    lockReason,
    lateEntry,
    openFixtures,
    editableIds,
    nextLockAt: lockReason || openFixtures.length === 0 ? null : fixtureLockTime(openFixtures[0]),
    nextLockIsWeek: rules.lockWeekAtFirstKickoff && !started,
  };
}
