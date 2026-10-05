import { clearAuth, getToken, saveAuth, tokenExpiresSoon } from "./auth";

const BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:63487";

// ── Response types ────────────────────────────────────────────────────────────

export interface AuthResponse {
  token: string;
  userId: string;
  name: string;
  email: string;
  role: "user" | "admin";
  expiresAt: string;
  mustResetPassword: boolean;
  isSystemUser: boolean;
}

export interface ScoreDto {
  home: number;
  away: number;
}

export type FixtureStatus = "pre_match" | "live" | "ended" | "postponed" | "cancelled";
export type OutcomeType = "home_win" | "away_win" | "draw" | "correct_score";

export interface FixtureDto {
  id: string;
  weekId: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  status: FixtureStatus;
  finalScore: ScoreDto | null;
  liveScore: ScoreDto | null;
  liveMinute: number | null;
}

export interface MatchWeekDto {
  id: string;
  name: string;
  competition: string;
  fixtures: FixtureDto[];
}

export interface PredictionDto {
  id: string;
  fixtureId: string;
  weekId: string;
  outcome: OutcomeType;
  homeGoals: number | null;
  awayGoals: number | null;
  pointsEarned: number;
  submittedAt: string;
}

export interface PredictionItem {
  fixtureId: string;
  outcome: OutcomeType;
  homeGoals?: number;
  awayGoals?: number;
}

export interface LeaderboardEntryDto {
  userId: string;
  name: string;
  totalPoints: number;
  // Points carried over from before the app; already included in totalPoints. Always 0 on weekly boards.
  previousPoints: number;
  position: number;
  lastSubmittedAt: string | null;
}

export interface PreviousPointsDto {
  label: string;
  points: number;
  updatedAt: string;
}

export interface PreviousPointsEntryDto {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  points: number;
  label: string;
  createdAt: string;
  updatedAt: string;
}

export interface PreviousPointsImportRow {
  email: string;
  points: number;
  name?: string;
  phoneNumber?: string;
  whatsAppName?: string;
}

export type PreviousPointsImportAction = "add" | "update" | "create_user" | "unchanged" | "error";

export interface PreviousPointsImportResult {
  dryRun: boolean;
  committed: boolean;
  errorCount: number;
  rows: {
    rowNumber: number;
    email: string;
    name: string | null;
    points: number;
    action: PreviousPointsImportAction;
    currentPoints: number | null;
    error: string | null;
  }[];
  createdAccounts: { name: string; email: string; temporaryPassword: string }[];
}

export interface ScraperSettingsDto {
  enabled: boolean;
  pollIntervalSeconds: number;
  competition: string;
  sourceName: string;
  availableSources: string[];
  predictionsLocked: boolean;
  registrationClosed: boolean;
  reminderEnabled: boolean;
  reminderHoursBeforeFirstGame: number;
}

export interface AdminStatusDto {
  lastScrapedAt: string | null;
  scraperEnabled: boolean;
  remindersConfigured: boolean;
  predictionsLocked: boolean;
  registrationClosed: boolean;
}

export interface AuditLogSettingsDto {
  enabled: boolean;
}

export interface UserSummaryDto {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  whatsAppName: string | null;
  role: "user" | "admin";
  isDisabled: boolean;
  isSystemUser: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  role: "Admin" | "User";
  phoneNumber?: string;
  whatsAppName?: string;
  password?: string;
}

export interface UserProfileDto {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  whatsAppName: string | null;
  role: "user" | "admin";
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AuditLogEntryDto {
  id: string;
  userId: string | null;
  userName: string | null;
  actorUserId: string | null;
  actorName: string | null;
  action: string;
  field: string | null;
  previousValue: string | null;
  newValue: string | null;
  details: string | null;
  createdAt: string;
}

export interface PagedAuditLogDto {
  items: AuditLogEntryDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export type FixtureStatusName = "PreMatch" | "Live" | "HalfTime" | "Ended" | "Postponed" | "Cancelled";

export interface UpdateScraperSettingsPayload {
  enabled: boolean;
  pollIntervalSeconds: number;
  competition: string;
  sourceName: string;
  reminderEnabled: boolean;
  reminderHoursBeforeFirstGame: number;
}

// ── Core request helper ───────────────────────────────────────────────────────

type RefreshOutcome = "ok" | "expired" | "disabled";

let refreshInFlight: Promise<RefreshOutcome> | null = null;

// Swaps the httpOnly refresh cookie for a new access token. Concurrent callers share one
// request, since each refresh rotates the cookie and a second parallel one would present a
// token the server has just revoked.
export function refreshSession(): Promise<RefreshOutcome> {
  refreshInFlight ??= (async (): Promise<RefreshOutcome> => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/refresh`, { method: "POST" });
      if (res.status === 403) return "disabled";
      if (!res.ok) return "expired";
      const auth = (await res.json()) as AuthResponse;
      // The refresh response carries the user's current role/flags, so a change an admin made
      // (e.g. a promotion) shows up here without a fresh login.
      saveAuth(auth.token, {
        id: auth.userId,
        name: auth.name,
        email: auth.email,
        role: auth.role,
        mustResetPassword: auth.mustResetPassword,
        isSystemUser: auth.isSystemUser,
      });
      return "ok";
    } catch {
      // Network failure: not proof the session is gone, so don't sign the user out over it.
      return "ok";
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

function endSession(outcome: Exclude<RefreshOutcome, "ok">): never {
  clearAuth();
  window.location.replace(outcome === "disabled" ? "/?disabled=1" : "/");
  throw new Error(
    outcome === "disabled"
      ? "Your account has been disabled. Please contact an admin."
      : "Session expired. Please log in again.",
  );
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Auth endpoints answer 401 for ordinary reasons (e.g. a wrong password on login), so they
  // never trigger a refresh or a forced sign-out.
  const isAuthEndpoint = path.startsWith("/api/auth/");

  if (!isAuthEndpoint) {
    const current = getToken();
    if (current && tokenExpiresSoon(current)) {
      const outcome = await refreshSession();
      if (outcome !== "ok") endSession(outcome);
    }
  }

  const send = () => {
    const token = getToken();
    return fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {}),
      },
    });
  };

  const token = getToken();
  let res = await send();

  if (res.status === 401 && !isAuthEndpoint) {
    const outcome = await refreshSession();
    if (outcome !== "ok") endSession(outcome);
    res = await send();
    if (res.status === 401) endSession("expired");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const { message, code } = body as { message?: string; code?: string };

    if (code === "account_disabled") {
      // Only force a redirect when this was an authenticated request that got cut off
      // mid-session — a login attempt has no token yet, so let the caller's own error
      // handling (a toast right on the login form) surface the message instead.
      if (token) {
        clearAuth();
        window.location.replace("/?disabled=1");
      }
    }

    throw new Error(message ?? `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as T;
}

// ── API surface ───────────────────────────────────────────────────────────────

export const api = {
  auth: {
    registrationStatus: () => request<{ open: boolean }>("/api/auth/registration-status"),
    login: (email: string, password: string) =>
      request<AuthResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    register: (name: string, email: string, phoneNumber: string, whatsAppName: string, password: string) =>
      request<AuthResponse>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, phoneNumber, whatsAppName, password }),
      }),
    // Revokes the refresh token server-side and clears its cookie.
    logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  },

  users: {
    me: () => request<UserProfileDto>("/api/users/me"),
    updateProfile: (name: string, phoneNumber: string, whatsAppName: string) =>
      request<UserProfileDto>("/api/users/me", {
        method: "PUT",
        body: JSON.stringify({ name, phoneNumber, whatsAppName }),
      }),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<{ message: string }>("/api/users/me/password", {
        method: "PUT",
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
    previousPoints: () => request<PreviousPointsDto[]>("/api/users/me/previous-points"),
  },

  weeks: {
    list: () => request<MatchWeekDto[]>("/api/weeks"),
    current: () => request<MatchWeekDto>("/api/weeks/current"),
    byId: (id: string) => request<MatchWeekDto>(`/api/weeks/${encodeURIComponent(id)}`),
  },

  fixtures: {
    list: (weekId?: string, status?: string) => {
      const params = new URLSearchParams();
      if (weekId) params.set("weekId", weekId);
      if (status) params.set("status", status);
      const qs = params.toString();
      return request<FixtureDto[]>(`/api/fixtures${qs ? `?${qs}` : ""}`);
    },
    byId: (id: string) => request<FixtureDto>(`/api/fixtures/${encodeURIComponent(id)}`),
  },

  predictions: {
    submit: (weekId: string, predictions: PredictionItem[]) =>
      request<{ message: string }>("/api/predictions", {
        method: "POST",
        body: JSON.stringify({ weekId, predictions }),
      }),
    mine: (weekId?: string) => {
      const qs = weekId ? `?weekId=${encodeURIComponent(weekId)}` : "";
      return request<PredictionDto[]>(`/api/predictions/me${qs}`);
    },
    lockStatus: () => request<{ locked: boolean }>("/api/predictions/lock-status"),
  },

  leaderboard: {
    overall: () => request<LeaderboardEntryDto[]>("/api/leaderboard"),
    byWeek: (weekId: string) =>
      request<LeaderboardEntryDto[]>(`/api/leaderboard/${encodeURIComponent(weekId)}`),
  },

  admin: {
    getSettings: () => request<ScraperSettingsDto>("/api/admin/settings"),
    updateSettings: (settings: UpdateScraperSettingsPayload) =>
      request<ScraperSettingsDto>("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      }),
    setPredictionsLock: (locked: boolean) =>
      request<ScraperSettingsDto>("/api/admin/predictions-lock", {
        method: "PUT",
        body: JSON.stringify({ locked }),
      }),
    setRegistrationClosed: (closed: boolean) =>
      request<ScraperSettingsDto>("/api/admin/registration", {
        method: "PUT",
        body: JSON.stringify({ closed }),
      }),
    status: () => request<AdminStatusDto>("/api/admin/status"),
    auditLogSettings: {
      get: () => request<AuditLogSettingsDto>("/api/admin/audit-log-settings"),
      set: (enabled: boolean) =>
        request<AuditLogSettingsDto>("/api/admin/audit-log-settings", {
          method: "PUT",
          body: JSON.stringify({ enabled }),
        }),
    },
    audit: {
      list: (params?: { userId?: string; search?: string; page?: number; pageSize?: number }) => {
        const qs = new URLSearchParams();
        if (params?.userId) qs.set("userId", params.userId);
        if (params?.search) qs.set("search", params.search);
        if (params?.page) qs.set("page", String(params.page));
        if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
        const s = qs.toString();
        return request<PagedAuditLogDto>(`/api/admin/audit${s ? `?${s}` : ""}`);
      },
    },
    previousPoints: {
      list: () => request<PreviousPointsEntryDto[]>("/api/admin/previous-points"),
      // System user only. dryRun validates and previews without saving; nothing is saved if any row errors.
      import: (label: string, rows: PreviousPointsImportRow[], dryRun: boolean) =>
        request<PreviousPointsImportResult>("/api/admin/previous-points/import", {
          method: "POST",
          body: JSON.stringify({ label, rows, dryRun }),
        }),
      remove: (id: string) =>
        request<{ message: string }>(`/api/admin/previous-points/${encodeURIComponent(id)}`, {
          method: "DELETE",
        }),
    },
    users: {
      list: () => request<UserSummaryDto[]>("/api/admin/users"),
      // System user only. When `password` is omitted the backend generates one and returns it once.
      create: (payload: CreateUserPayload) =>
        request<{ user: UserSummaryDto; temporaryPassword: string | null }>("/api/admin/users", {
          method: "POST",
          body: JSON.stringify(payload),
        }),
      setRole: (id: string, role: "Admin" | "User") =>
        request<UserSummaryDto>(`/api/admin/users/${encodeURIComponent(id)}/role`, {
          method: "PUT",
          body: JSON.stringify({ role }),
        }),
      setStatus: (id: string, isDisabled: boolean) =>
        request<UserSummaryDto>(`/api/admin/users/${encodeURIComponent(id)}/status`, {
          method: "PUT",
          body: JSON.stringify({ isDisabled }),
        }),
      remove: (id: string) =>
        request<{ message: string }>(`/api/admin/users/${encodeURIComponent(id)}`, {
          method: "DELETE",
        }),
      resetPassword: (id: string) =>
        request<{ temporaryPassword: string }>(`/api/admin/users/${encodeURIComponent(id)}/reset-password`, {
          method: "POST",
        }),
    },
    weeks: {
      create: (name: string, competition: string) =>
        request<MatchWeekDto>("/api/admin/weeks", {
          method: "POST",
          body: JSON.stringify({ name, competition }),
        }),
      update: (id: string, name: string, competition: string) =>
        request<MatchWeekDto>(`/api/admin/weeks/${encodeURIComponent(id)}`, {
          method: "PUT",
          body: JSON.stringify({ name, competition }),
        }),
      remove: (id: string) =>
        request<{ message: string }>(`/api/admin/weeks/${encodeURIComponent(id)}`, {
          method: "DELETE",
        }),
    },
    fixtures: {
      create: (weekId: string, homeTeam: string, awayTeam: string, kickoffIso: string) =>
        request<FixtureDto>(`/api/admin/weeks/${encodeURIComponent(weekId)}/fixtures`, {
          method: "POST",
          body: JSON.stringify({ homeTeam, awayTeam, kickoff: kickoffIso }),
        }),
      update: (
        id: string,
        payload: {
          homeTeam: string;
          awayTeam: string;
          kickoffIso: string;
          status: FixtureStatusName;
          finalScoreHome?: number;
          finalScoreAway?: number;
          weekId?: string;
        },
      ) =>
        request<FixtureDto>(`/api/admin/fixtures/${encodeURIComponent(id)}`, {
          method: "PUT",
          body: JSON.stringify({
            homeTeam: payload.homeTeam,
            awayTeam: payload.awayTeam,
            kickoff: payload.kickoffIso,
            status: payload.status,
            finalScoreHome: payload.finalScoreHome,
            finalScoreAway: payload.finalScoreAway,
            weekId: payload.weekId,
          }),
        }),
      remove: (id: string) =>
        request<{ message: string }>(`/api/admin/fixtures/${encodeURIComponent(id)}`, {
          method: "DELETE",
        }),
    },
  },
};
