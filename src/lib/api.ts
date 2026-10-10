import { clearAuth, getToken, saveAuth, tokenExpiresSoon } from "./auth";
import type { PredictionRules } from "./predictionRules";

const BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:63487";

export const CHAT_HUB_URL = `${BASE_URL}/api/hubs/chat`;

// ── Response types ────────────────────────────────────────────────────────────

export type LoginMethod = "email" | "whatsapp";

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
  // Exact scores called (overall boards include previous ones). First tiebreak on equal points.
  correctScores: number;
  position: number;
  lastSubmittedAt: string | null;
}

export interface PreviousPointsDto {
  label: string;
  points: number;
  correctScores: number;
  updatedAt: string;
}

export interface PreviousPointsEntryDto {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  points: number;
  correctScores: number;
  label: string;
  createdAt: string;
  updatedAt: string;
}

// Matched by email when given, otherwise by WhatsApp name. correctScores left out keeps the current count.
export interface PreviousPointsImportRow {
  email?: string;
  points: number;
  correctScores?: number;
  name?: string;
  phoneNumber?: string;
  whatsAppName?: string;
}

export type PreviousPointsImportAction = "add" | "update" | "create_user" | "unchanged" | "skipped" | "error";

export interface PreviousPointsImportResult {
  dryRun: boolean;
  committed: boolean;
  errorCount: number;
  rows: {
    rowNumber: number;
    email: string;
    name: string | null;
    whatsAppName: string | null;
    points: number;
    correctScores: number;
    action: PreviousPointsImportAction;
    currentPoints: number | null;
    currentCorrectScores: number | null;
    matchedBy: "email" | "whatsapp" | "name" | null;
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
  predictionRules: PredictionRules;
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

// A prediction whose points (or week) the server found wrong and fixed (Services/PointsReconciler.cs).
export interface PointsCorrectionDto {
  predictionId: string;
  userId: string;
  userName: string;
  fixtureId: string;
  match: string;
  previousPoints: number;
  points: number;
  previousWeekId: string;
  weekId: string;
}

// How the Cloudflare Worker handles Render putting the backend to sleep (worker/wake.ts).
export type WakeMode = "keepalive" | "retry" | "none" | "matchwindows";

export interface WakeConfigDto {
  mode: WakeMode;
  retryCount: number;
  maxRetryCount: number;
  retryDelaySeconds: number;
  // When the backend has matches to follow, as last fetched by the Worker (null until fetched).
  schedule: {
    fetchedAt: string;
    inWindow: boolean;
    nextWindow: { start: string; end: string } | null;
  } | null;
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

// Back-office permission keys; the backend's Services/Permissions.cs is the source of truth.
export type Permission =
  | "fixtures.manage"
  | "participation.view"
  | "users.view"
  | "users.create"
  | "users.edit"
  | "users.status"
  | "users.reset_password"
  | "users.delete"
  | "previous_points.view"
  | "previous_points.manage"
  | "audit.view"
  | "settings.view"
  | "settings.manage"
  | "predictions.rules"
  | "messages.broadcast";

export interface MyPermissionsDto {
  isSystemUser: boolean;
  permissions: Record<string, boolean>;
}

export interface PermissionDefinitionDto {
  key: Permission;
  group: string;
  label: string;
  description: string;
}

export interface AdminPermissionsDto {
  userId: string;
  name: string;
  email: string;
  whatsAppName: string | null;
  isDisabled: boolean;
  // Only the permissions this admin has an exception for.
  overrides: Record<string, boolean>;
  effective: Record<string, boolean>;
}

export interface PermissionsOverviewDto {
  permissions: PermissionDefinitionDto[];
  defaults: Record<string, boolean>;
  admins: AdminPermissionsDto[];
}

export interface PlayerParticipationDto {
  userId: string;
  name: string;
  whatsAppName: string | null;
  phoneNumber: string | null;
  email: string;
  // Predictions made for the week; equals the week's fixtureCount when complete.
  predicted: number;
  submittedAt: string | null;
  lastLoginAt: string | null;
}

export interface WeekParticipationDto {
  weekId: string;
  weekName: string;
  // Fixtures that can be predicted (postponed and cancelled ones left out).
  fixtureCount: number;
  // Earliest fixture still to start; null once all have started.
  nextKickoff: string | null;
  players: PlayerParticipationDto[];
}

export interface CreateUserPayload {
  name: string;
  email: string;
  role: "Admin" | "User";
  phoneNumber?: string;
  whatsAppName?: string;
  password?: string;
}

export interface UpdateUserDetailsPayload {
  name?: string;
  email?: string;
  phoneNumber?: string;
  whatsAppName?: string;
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

// Chat. No emails or phone numbers here: every player can see these.
export interface ChatUserDto {
  id: string;
  name: string;
  whatsAppName: string | null;
  isAdmin: boolean;
  isOnline: boolean;
}

export interface ChatMessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  // null once deleted.
  body: string | null;
  isAnnouncement: boolean;
  clientId: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface ConversationDto {
  id: string;
  other: ChatUserDto;
  lastMessage: ChatMessageDto | null;
  unreadCount: number;
  myLastReadAt: string | null;
  // Every message of mine sent up to here shows as "Seen".
  otherLastReadAt: string | null;
  lastMessageAt: string;
}

export interface MessagePageDto {
  items: ChatMessageDto[];
  hasMore: boolean;
}

export interface ReadReceiptDto {
  conversationId: string;
  userId: string;
  readAt: string;
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

// For connections that can't go through request() (the chat hub): a usable access token,
// refreshed first if it's about to expire. Throws (and signs out) when the session is over.
export async function getFreshToken(): Promise<string> {
  const current = getToken();
  if (current && !tokenExpiresSoon(current)) return current;
  const outcome = await refreshSession();
  if (outcome !== "ok") endSession(outcome);
  const token = getToken();
  if (!token) endSession("expired");
  return token;
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
    // `login` is an email address or a WhatsApp name, as `method` says.
    login: (method: LoginMethod, login: string, password: string) =>
      request<AuthResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ method, login, password }),
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
    lockStatus: () => request<{ locked: boolean; rules: PredictionRules }>("/api/predictions/lock-status"),
  },

  chat: {
    conversations: () => request<ConversationDto[]>("/api/chat/conversations"),
    conversation: (id: string) => request<ConversationDto>(`/api/chat/conversations/${encodeURIComponent(id)}`),
    // Opens (or starts) the one conversation with this player.
    start: (userId: string) =>
      request<ConversationDto>("/api/chat/conversations", {
        method: "POST",
        body: JSON.stringify({ userId }),
      }),
    // Oldest first. Pass the oldest loaded message's id to get the page before it.
    messages: (conversationId: string, before?: string) =>
      request<MessagePageDto>(
        `/api/chat/conversations/${encodeURIComponent(conversationId)}/messages${
          before ? `?before=${encodeURIComponent(before)}` : ""
        }`,
      ),
    // clientId makes a retried send safe: the server returns the original instead of posting twice.
    send: (conversationId: string, body: string, clientId: string) =>
      request<ChatMessageDto>(`/api/chat/conversations/${encodeURIComponent(conversationId)}/messages`, {
        method: "POST",
        body: JSON.stringify({ body, clientId }),
      }),
    markRead: (conversationId: string) =>
      request<ReadReceiptDto>(`/api/chat/conversations/${encodeURIComponent(conversationId)}/read`, {
        method: "POST",
      }),
    remove: (messageId: string) =>
      request<ChatMessageDto>(`/api/chat/messages/${encodeURIComponent(messageId)}`, { method: "DELETE" }),
    directory: () => request<ChatUserDto[]>("/api/chat/users"),
    // Admins with "Send announcements". No userIds = every active player.
    broadcast: (body: string, userIds?: string[]) =>
      request<{ recipients: number }>("/api/chat/broadcast", {
        method: "POST",
        body: JSON.stringify({ body, userIds }),
      }),
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
    // Needs "Change prediction rules" (the system admin's unless granted).
    setPredictionRules: (rules: PredictionRules) =>
      request<ScraperSettingsDto>("/api/admin/prediction-rules", {
        method: "PUT",
        body: JSON.stringify(rules),
      }),
    setRegistrationClosed: (closed: boolean) =>
      request<ScraperSettingsDto>("/api/admin/registration", {
        method: "PUT",
        body: JSON.stringify({ closed }),
      }),
    status: () => request<AdminStatusDto>("/api/admin/status"),
    permissions: {
      // Any admin: what they themselves may do.
      mine: () => request<MyPermissionsDto>("/api/admin/permissions/me"),
      // The rest are the system admin's.
      overview: () => request<PermissionsOverviewDto>("/api/admin/permissions"),
      updateDefaults: (permissions: Record<string, boolean>) =>
        request<PermissionsOverviewDto>("/api/admin/permissions/defaults", {
          method: "PUT",
          body: JSON.stringify({ permissions }),
        }),
      // null removes the admin's exception so they follow the default again.
      updateAdmin: (userId: string, overrides: Record<string, boolean | null>) =>
        request<PermissionsOverviewDto>(`/api/admin/permissions/users/${encodeURIComponent(userId)}`, {
          method: "PUT",
          body: JSON.stringify({ overrides }),
        }),
    },
    // System admin only. Answered by the Cloudflare Worker itself, so only on the deployed site.
    wakeConfig: {
      get: () => request<WakeConfigDto>("/api/edge/wake-config"),
      set: (mode: WakeMode, retryCount: number) =>
        request<WakeConfigDto>("/api/edge/wake-config", {
          method: "PUT",
          body: JSON.stringify({ mode, retryCount }),
        }),
    },
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
      // System user only. Only the fields present are changed; "" clears phone/WhatsApp.
      updateDetails: (id: string, details: UpdateUserDetailsPayload) =>
        request<UserSummaryDto>(`/api/admin/users/${encodeURIComponent(id)}`, {
          method: "PUT",
          body: JSON.stringify(details),
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
      // Every active player's prediction count for the week.
      participation: (weekId: string) =>
        request<WeekParticipationDto>(`/api/admin/weeks/${encodeURIComponent(weekId)}/participation`),
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
    // Recalculates every prediction's points and fixes wrong ones; returns what changed.
    recheckPoints: () => request<PointsCorrectionDto[]>("/api/admin/points/recheck", { method: "POST" }),
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
