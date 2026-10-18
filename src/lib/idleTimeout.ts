// Idle sign-out: after the configured minutes without a tap, click, key press or scroll, the app
// signs out. The minutes come from the server (/api/auth/session-settings, set on the admin
// Settings page). The last activity is kept in localStorage so every open tab shares one clock:
// using the app in one tab keeps the others signed in, and closing the app for longer than the
// timeout means signing in again when it's next opened.
const LAST_ACTIVITY_KEY = "op_last_activity";
const MINUTES_KEY = "op_idle_minutes";

export const DEFAULT_IDLE_MINUTES = 15;

// Activity is written at most this often, so moving the mouse doesn't write storage every frame.
const WRITE_EVERY_MS = 5_000;
let lastWrite = 0;

export function noteActivity(now = Date.now()): void {
  if (now - lastWrite < WRITE_EVERY_MS) return;
  lastWrite = now;
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
  } catch {
    // Storage unavailable (private mode): this tab still counts its own activity below.
  }
}

// Starts the clock afresh, e.g. on signing in, whatever was recorded before.
export function resetActivity(now = Date.now()): void {
  lastWrite = 0;
  noteActivity(now);
}

export function getLastActivity(): number | null {
  try {
    const value = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function getIdleMinutes(): number {
  try {
    const value = Number(localStorage.getItem(MINUTES_KEY));
    return Number.isInteger(value) && value > 0 ? value : DEFAULT_IDLE_MINUTES;
  } catch {
    return DEFAULT_IDLE_MINUTES;
  }
}

// Remembered so a reopened app can tell it has been idle too long before the server answers.
export function setIdleMinutes(minutes: number): void {
  try {
    localStorage.setItem(MINUTES_KEY, String(minutes));
  } catch {
    // Falls back to the default next time.
  }
}

// True once the last recorded activity is older than the timeout. With nothing recorded (a
// session from before this existed) it isn't: the clock starts now instead.
export function isIdleExpired(now = Date.now(), minutes = getIdleMinutes()): boolean {
  const last = getLastActivity();
  if (last === null) {
    resetActivity(now);
    return false;
  }
  return now - last >= minutes * 60_000;
}
