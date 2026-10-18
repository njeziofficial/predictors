import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_IDLE_MINUTES,
  getIdleMinutes,
  getLastActivity,
  isIdleExpired,
  noteActivity,
  resetActivity,
  setIdleMinutes,
} from "@/lib/idleTimeout";

const MINUTE = 60_000;

describe("idle sign-out", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to 15 minutes until the server says otherwise", () => {
    expect(getIdleMinutes()).toBe(DEFAULT_IDLE_MINUTES);
    expect(DEFAULT_IDLE_MINUTES).toBe(15);
    setIdleMinutes(30);
    expect(getIdleMinutes()).toBe(30);
  });

  it("starts the clock instead of signing out when nothing was recorded", () => {
    const now = 1_000_000_000;
    expect(isIdleExpired(now, 15)).toBe(false);
    expect(getLastActivity()).toBe(now);
  });

  it("signs out once the last activity is older than the timeout", () => {
    const start = 2_000_000_000;
    resetActivity(start);
    expect(isIdleExpired(start + 14 * MINUTE, 15)).toBe(false);
    expect(isIdleExpired(start + 15 * MINUTE, 15)).toBe(true);
  });

  it("activity pushes the timeout back", () => {
    const start = 3_000_000_000;
    resetActivity(start);
    noteActivity(start + 10 * MINUTE);
    expect(isIdleExpired(start + 20 * MINUTE, 15)).toBe(false);
    expect(isIdleExpired(start + 25 * MINUTE, 15)).toBe(true);
  });

  it("signing in starts afresh after a long gap", () => {
    resetActivity(4_000_000_000);
    const later = 4_000_000_000 + 60 * MINUTE;
    resetActivity(later);
    expect(isIdleExpired(later + MINUTE, 15)).toBe(false);
  });
});
