const TOKEN_KEY = "op_token";
const USER_KEY = "op_user";

// Fired on this window whenever the stored session changes outside React (a silent token
// refresh, or a forced sign-out), so AppContext can re-sync currentUser. Other tabs get the
// browser's own "storage" event instead.
export const AUTH_CHANGED_EVENT = "op-auth-changed";

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  mustResetPassword: boolean;
  isSystemUser: boolean;
}

// Only the short-lived access token is kept here. The refresh token lives in an httpOnly cookie
// that page scripts can't read — see /api/auth/refresh.
export function saveAuth(token: string, user: StoredUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function updateStoredUser(patch: Partial<StoredUser>): StoredUser | null {
  const current = getStoredUser();
  if (!current) return null;
  const updated = { ...current, ...patch };
  localStorage.setItem(USER_KEY, JSON.stringify(updated));
  return updated;
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function getStoredUser(): StoredUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

// True when the access token expires within `withinSeconds` (or can't be read), so a request
// can refresh up front instead of failing with a 401 first. The server still has the final say.
export function tokenExpiresSoon(token: string, withinSeconds = 30): boolean {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const { exp } = JSON.parse(atob(payload)) as { exp?: number };
    return typeof exp !== "number" || exp * 1000 - Date.now() < withinSeconds * 1000;
  } catch {
    return true;
  }
}
