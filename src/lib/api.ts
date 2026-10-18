import { clearAuth, getToken, saveAuth, tokenExpiresSoon } from "./auth";
import { noteLiveBundle } from "./appVersion";
import type { CreationOptionsJson, RequestOptionsJson } from "./passkeys";
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
  // Knockout matches that went to extra time: the score after it. finalScore stays the score
  // after 90 minutes, which is what predictions are marked on.
  afterExtraTime?: ScoreDto | null;
}

export interface MatchWeekDto {
  id: string;
  name: string;
  competition: string;
  // Which competition's tables the week counts towards ("la-liga", "champions-league").
  competitionId: string;
  fixtures: FixtureDto[];
}

export interface CompetitionDto {
  id: string;
  name: string;
  // Off: hidden from players and closed to predictions. Only admins are sent ones that are off.
  enabled: boolean;
  sortOrder: number;
}

// Where a competition other than La Liga is scraped from (system admin only).
export interface CompetitionScrapingDto {
  id: string;
  name: string;
  enabled: boolean;
  sourceMode: SourceMode;
  sourceName: string;
  sourceOrder: string[];
  availableSources: string[];
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
  whatsAppName: string | null;
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
  // Missing from a backend older than source modes.
  sourceMode?: SourceMode;
  sourceOrder?: string[];
  // The sources that can create new fixtures (they report which round a match is in).
  roundSources?: string[];
  predictionsLocked: boolean;
  registrationClosed: boolean;
  reminderEnabled: boolean;
  // Hours before each week's first match a reminder goes out (72 = 3 days), earliest reminder
  // first. Missing from an older backend (which had a single reminderHoursBeforeFirstGame).
  reminderOffsetsHours?: number[];
  predictionRules: PredictionRules;
}

export interface AdminStatusDto {
  lastScrapedAt: string | null;
  scraperEnabled: boolean;
  // Whether Twilio is set up, so reminders also go out by WhatsApp/SMS.
  remindersConfigured: boolean;
  predictionsLocked: boolean;
  registrationClosed: boolean;
  // Sources that failed or were refused lately. Missing from an older backend.
  sourceProblems?: SourceProblemDto[];
  // Active players with push notifications on, whom reminders reach. Missing from an older backend.
  playersWithNotifications?: number;
}

// coolingUntil is set while the scraper is leaving the source alone after it refused or kept failing.
export interface SourceProblemDto {
  name: string;
  failures: number;
  coolingUntil: string | null;
  lastProblem: string | null;
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
  | "marking.view"
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
  | "competitions.manage"
  | "messages.broadcast"
  | "notifications.send"
  | "wallet.view"
  | "wallet.manage"
  | "security.idle_timeout";

export interface IdleTimeoutDto {
  minutes: number;
}

// ── Wallet ledger ──
// No money moves through the app: entry fees are paid into the organiser's bank account and
// winners are paid by bank transfer. The ledger records it. Amounts are in kobo (₦1 = 100) and
// signed: an entry fee and winnings are plus, a payout minus, an adjustment either way.
export type WalletKind = "entry_fee" | "winnings" | "payout" | "adjustment";

export interface WalletEntryDto {
  id: string;
  userId: string;
  season: string;
  kind: WalletKind;
  amountKobo: number;
  note: string | null;
  occurredAt: string;
  createdAt: string;
  createdByName: string;
  // On a reversal: the entry it cancels.
  reversesEntryId: string | null;
  // On an entry that has been reversed.
  reversed: boolean;
}

export interface MyWalletDto {
  season: string;
  currentSeason: string;
  seasons: string[];
  entryFeeKobo: number;
  paid: boolean;
  paidInKobo: number;
  wonKobo: number;
  paidOutKobo: number;
  // Won but not yet paid to them.
  balanceKobo: number;
  potKobo: number;
  paidPlayers: number;
  entries: WalletEntryDto[];
}

export interface WalletPlayerDto {
  userId: string;
  name: string;
  whatsAppName: string | null;
  isDisabled: boolean;
  paid: boolean;
  paidInKobo: number;
  wonKobo: number;
  paidOutKobo: number;
  balanceKobo: number;
}

export interface AdminWalletDto {
  season: string;
  currentSeason: string;
  seasons: string[];
  entryFeeKobo: number;
  potKobo: number;
  allocatedKobo: number;
  unallocatedKobo: number;
  paidOutKobo: number;
  // Won but not yet paid: what the organiser still has to send.
  owedKobo: number;
  paidPlayers: number;
  players: WalletPlayerDto[];
}

export interface PlayerLedgerDto {
  player: WalletPlayerDto;
  entries: WalletEntryDto[];
}

export interface NotificationPreferencesDto {
  reminders: boolean;
  announcements: boolean;
  // The same by email, when push is on in none of the player's browsers.
  email: boolean;
  // Chat messages pushed while the app isn't open, and whether they show the message text.
  messages: boolean;
  messagePreview: boolean;
}

export interface PasswordTokenDto {
  valid: boolean;
  purpose: "reset" | "welcome" | null;
  name: string | null;
}

export type EmailProviderName = "Resend" | "Brevo" | "Gmail";

export interface EmailProviderDto {
  name: EmailProviderName;
  // Its credentials are set on the server.
  configured: boolean;
  // The one sending now.
  active: boolean;
  // Who its emails come from now ("Name <address>"), or null with no address at all.
  from: string | null;
  // The address set on the admin page (null: none, so serverAddress is used).
  savedAddress: string | null;
  serverAddress: string | null;
  sentToday: number;
  dailyLimit: number;
  sentThisMonth: number;
  monthlyLimit: number;
}

// System admin only: email providers, the chosen one, and their use of the free limits.
export interface EmailStatusDto {
  configured: boolean;
  // "auto" or a provider name.
  choice: string;
  active: EmailProviderName | null;
  appUrl: string;
  dailyReserve: number;
  senderName: string;
  savedSenderName: string | null;
  providers: EmailProviderDto[];
  failedToday: number;
  lastError: string | null;
}

export type NotificationAudience = "everyone" | "yet-to-predict" | "selected";

// Who an admin notification goes to. important: also to players who turned admin notifications
// off (system admin only).
export interface NotificationTarget {
  audience: NotificationAudience;
  weekId?: string;
  userIds?: string[];
  important: boolean;
  // Also by email to those push can't reach.
  email?: boolean;
}

export interface SendNotificationPayload extends NotificationTarget {
  title: string;
  body: string;
  // A page in the app, e.g. "/predict".
  url: string;
}

// inAudience: players in it; willReceive: of those, with notifications on and not muted.
export interface NotificationAudienceDto {
  inAudience: number;
  willReceive: number;
  // By email instead (when email was asked for).
  willEmail?: number;
  // Null when email isn't set up.
  emailsLeftToday?: number | null;
  // Players who'll see it in the app's notifications (everyone who didn't turn admin news off).
  inApp?: number;
}

// The signed-in user's in-app notifications.
export interface InboxItemDto {
  id: string;
  kind: "reminder" | "announcement" | "test";
  title: string;
  body: string;
  // A page in the app.
  url: string;
  createdAt: string;
  read: boolean;
}

export interface InboxDto {
  // All unread, whatever the search.
  unread: number;
  items: InboxItemDto[];
  // How many match the search/filter, across all pages.
  total: number;
  page: number;
  pageSize: number;
}

// A passkey on the user's account: one of their devices that can sign them in.
export interface PasskeyDto {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  // base64url; matches the device's own id for it, so the app can tell which one it's running on.
  credentialId: string;
}

export interface InboxQuery {
  q?: string;
  unreadOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export interface NotificationPlayerDto {
  id: string;
  name: string;
  whatsAppName: string | null;
  isAdmin: boolean;
  hasNotifications: boolean;
  mutedAnnouncements: boolean;
}

export interface PushBroadcastDto {
  id: string;
  title: string;
  body: string;
  url: string;
  audience: NotificationAudience;
  weekId: string | null;
  weekName: string | null;
  important: boolean;
  targeted: number;
  reached: number;
  emailed?: number;
  sentByName: string;
  createdAt: string;
}

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

// The system admin's Scraper Health page (backend AdminScraperHealthController). The in-memory
// parts (state, polls, sources, logs) describe the server process answering, since it started.
export interface HealthWarning {
  severity: "error" | "warning";
  title: string;
  detail: string;
}

export interface HealthPoll {
  at: string;
  durationMs: number;
  plan: string[];
  source: string | null;
  matches: number;
  queued: number;
  outcome: "Ok" | "NoMatches" | "Resting" | "Failed";
  problem: string | null;
  // Which competition the poll was for ("La Liga" from servers before competitions).
  competition?: string;
}

export interface HealthSource {
  name: string;
  inUse: boolean;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastMatches: number;
  lastDurationMs: number;
  lastResult: string | null;
  failures: number;
  coolingUntil: string | null;
  lastProblem: string | null;
}

export interface HealthQueueRow {
  id: number;
  fixtureId: string;
  source: string;
  scrapedAt: string;
  processedAt: string | null;
  outcome: string | null;
  attempts: number;
  error: string | null;
  reading: string;
}

export interface HealthMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  status: FixtureStatus;
  scoreHome: number | null;
  scoreAway: number | null;
  minute: number | null;
  updatedAt: string;
  problem: string | null;
}

export interface HealthLogEntry {
  at: string;
  level: "Information" | "Warning" | "Error" | "Critical";
  category: string;
  message: string;
  exception: string | null;
}

export interface ScraperHealthDto {
  now: string;
  process: { startedAt: string; environment: string; version: string | null };
  settings: { enabled: boolean; mode: SourceMode; sources: string[]; pollIntervalSeconds: number; competition: string };
  state: {
    phase: "Starting" | "Polling" | "Waiting" | "Paused" | "Restarting";
    detail: string | null;
    nextPollAt: string | null;
    schedule: "InPlay" | "MatchWindow" | "NoMatch" | null;
    lastPollAt: string | null;
    lastSuccessAt: string | null;
  };
  warnings: HealthWarning[];
  polls: HealthPoll[];
  sources: HealthSource[];
  queue: {
    pending: number;
    oldestPendingAt: string | null;
    appliedLastHour: number;
    failedLastDay: number;
    lastAppliedAt: string | null;
    retentionHours: number;
    recent: HealthQueueRow[];
  };
  points: {
    lastRunAt: string | null;
    lastCorrections: number;
    lastError: string | null;
    weeks: { id: string; name: string; fixtures: number; finished: number; reconciledAt: string | null }[];
  };
  matches: HealthMatch[];
  logs: HealthLogEntry[];
}

// Every player's picks for a week with the result and points of each (backend WeekMarking).
// A pick is hidden (outcome null) until its match kicks off.
export interface MarkedPickDto {
  fixtureId: string;
  outcome: OutcomeType | null;
  homeGoals: number | null;
  awayGoals: number | null;
  points: number;
  // What the scoring rule gives now; differs from points only while a correction is pending.
  expectedPoints: number;
  reason: string;
}

export interface PlayerMarkingDto {
  userId: string;
  name: string;
  whatsAppName: string | null;
  points: number;
  expectedPoints: number;
  picksMade: number;
  picks: MarkedPickDto[];
}

export interface MarkingFixtureDto {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  status: FixtureStatus;
  finalScoreHome: number | null;
  finalScoreAway: number | null;
  picksVisible: boolean;
}

export interface WeekMarkingDto {
  weekId: string;
  weekName: string;
  // When the end-of-week check signed the week off; null until every match is over.
  reconciledAt: string | null;
  fixtures: MarkingFixtureDto[];
  players: PlayerMarkingDto[];
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
  // Ignored by the current backend (the source is set with setScraperSource); still sent, as the
  // saved value, because a backend from before source modes requires it.
  sourceName: string;
}

// See the backend's Services/Scraping/SourcePlan.cs.
export type SourceMode = "Single" | "Fallback" | "Rotate";

export interface ScraperSourcePayload {
  mode: SourceMode;
  sourceName: string;
  sourceOrder: string[];
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
  // null for text only, and once deleted.
  image?: ChatImageDto | null;
}

// A signed link to the image in Supabase Storage. It expires after a while (a day by default); fetching the
// messages again gives a fresh one.
export interface ChatImageDto {
  url: string;
  width: number | null;
  height: number | null;
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

// unavailable: the server couldn't answer (asleep, waking, offline). That says nothing about the
// session, so the player stays signed in and the next request tries again.
type RefreshOutcome = "ok" | "expired" | "disabled" | "unavailable";

const UNAVAILABLE_MESSAGE = "Can't reach the server right now. Try again in a moment.";

let refreshInFlight: Promise<RefreshOutcome> | null = null;

// Swaps the httpOnly refresh cookie for a new access token. Concurrent callers share one
// request, since each refresh rotates the cookie and a second parallel one would present a
// token the server has just revoked.
export function refreshSession(): Promise<RefreshOutcome> {
  refreshInFlight ??= (async (): Promise<RefreshOutcome> => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/refresh`, { method: "POST" });
      noteLiveBundle(res.headers);
      if (res.status === 403) return "disabled";
      // Only the server saying so ends the session. A 502/503/504 is the backend waking up
      // (Render's free tier sleeps), which used to sign players out whenever they reopened the app.
      if (res.status === 401) return "expired";
      if (!res.ok) return "unavailable";
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
      return "unavailable";
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
  // The hub retries on its own; keep the session for when the server is back.
  if (outcome === "unavailable") throw new Error(UNAVAILABLE_MESSAGE);
  if (outcome !== "ok") endSession(outcome);
  const token = getToken();
  if (!token) endSession("expired");
  return token;
}

function endSession(outcome: "expired" | "disabled"): never {
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
      if (outcome === "unavailable") throw new Error(UNAVAILABLE_MESSAGE);
      if (outcome !== "ok") endSession(outcome);
    }
  }

  const send = async () => {
    const token = getToken();
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        // A FormData body sets its own multipart type, with the boundary.
        ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {}),
      },
    });
    // The Worker says which build is live; a newer one shows the "new version" prompt.
    noteLiveBundle(res.headers);
    return res;
  };

  const token = getToken();
  let res = await send();

  if (res.status === 401 && !isAuthEndpoint) {
    const outcome = await refreshSession();
    if (outcome === "unavailable") throw new Error(UNAVAILABLE_MESSAGE);
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
    // Minutes without activity before the app signs out (see lib/idleTimeout).
    sessionSettings: () => request<IdleTimeoutDto>("/api/auth/session-settings"),
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
    // Emails a link to choose a new password (players only; always the same answer).
    forgotPassword: (email: string) =>
      request<{ message: string }>("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
    // Whether a link from a Forgot password or welcome email still works.
    checkPasswordToken: (token: string) =>
      request<PasswordTokenDto>("/api/auth/password-token", { method: "POST", body: JSON.stringify({ token }) }),
    setPassword: (token: string, newPassword: string) =>
      request<void>("/api/auth/set-password", { method: "POST", body: JSON.stringify({ token, newPassword }) }),
    // Signing in with fingerprint or face: what the device should sign, then its signature.
    passkeyOptions: () =>
      request<{ flowId: string; options: RequestOptionsJson }>("/api/auth/passkey/options", { method: "POST" }),
    passkeyLogin: (flowId: string, response: unknown) =>
      request<AuthResponse>("/api/auth/passkey", { method: "POST", body: JSON.stringify({ flowId, response }) }),
  },

  // The signed-in user's passkeys (signing in with fingerprint or face), in Profile.
  passkeys: {
    list: () => request<PasskeyDto[]>("/api/passkeys"),
    registrationOptions: () =>
      request<{ flowId: string; options: CreationOptionsJson }>("/api/passkeys/register/options", { method: "POST" }),
    register: (flowId: string, name: string, response: unknown) =>
      request<PasskeyDto>("/api/passkeys/register", { method: "POST", body: JSON.stringify({ flowId, name, response }) }),
    remove: (id: string) => request<void>(`/api/passkeys/${encodeURIComponent(id)}`, { method: "DELETE" }),
  },

  // The player's own wallet: paid or not, winnings, payouts, and the pot.
  wallet: {
    get: (season?: string) => request<MyWalletDto>(`/api/wallet${season ? `?season=${encodeURIComponent(season)}` : ""}`),
  },

  // In-app notifications: reminders and admin notifications, kept for the next visit.
  notifications: {
    list: (query: InboxQuery = {}) => {
      const params = new URLSearchParams();
      if (query.q?.trim()) params.set("q", query.q.trim());
      if (query.unreadOnly) params.set("unreadOnly", "true");
      if (query.page) params.set("page", String(query.page));
      if (query.pageSize) params.set("pageSize", String(query.pageSize));
      const qs = params.toString();
      return request<InboxDto>(`/api/notifications${qs ? `?${qs}` : ""}`);
    },
    markRead: (id: string) => request<void>(`/api/notifications/${encodeURIComponent(id)}/read`, { method: "POST" }),
    markAllRead: () => request<void>("/api/notifications/read-all", { method: "POST" }),
    remove: (id: string) => request<void>(`/api/notifications/${encodeURIComponent(id)}`, { method: "DELETE" }),
    removeMany: (ids: string[]) =>
      request<{ deleted: number }>("/api/notifications/delete", { method: "POST", body: JSON.stringify({ ids }) }),
    removeRead: () => request<{ deleted: number }>("/api/notifications/delete-read", { method: "POST" }),
  },

  // Push notifications for this browser (see lib/push.ts).
  push: {
    publicKey: () => request<{ publicKey: string }>("/api/push/public-key"),
    subscribe: (subscription: PushSubscriptionJSON) =>
      request<void>("/api/push/subscriptions", { method: "POST", body: JSON.stringify(subscription) }),
    unsubscribe: (endpoint: string) =>
      request<void>("/api/push/subscriptions/remove", { method: "POST", body: JSON.stringify({ endpoint }) }),
    // Sends a notification to the caller's own browsers; reached is how many took it.
    test: () => request<{ reached: number }>("/api/push/test", { method: "POST" }),
    // Which notifications the caller wants, on all their devices.
    preferences: () => request<NotificationPreferencesDto>("/api/push/preferences"),
    setPreferences: (prefs: NotificationPreferencesDto) =>
      request<NotificationPreferencesDto>("/api/push/preferences", { method: "PUT", body: JSON.stringify(prefs) }),
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

  // The ones the caller can see: switched on, or every one for an admin.
  competitions: {
    list: () => request<CompetitionDto[]>("/api/competitions"),
  },

  // Every week of every competition the caller can see; pages keep the chosen competition's
  // (see CompetitionContext).
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
    // An image with an optional caption; clientId makes a retry safe, as for text.
    sendImage: (
      conversationId: string,
      image: { blob: Blob; name: string; width: number; height: number },
      body: string,
      clientId: string,
    ) => {
      const form = new FormData();
      form.append("file", image.blob, image.name);
      form.append("body", body);
      form.append("clientId", clientId);
      form.append("width", String(image.width));
      form.append("height", String(image.height));
      return request<ChatMessageDto>(`/api/chat/conversations/${encodeURIComponent(conversationId)}/images`, {
        method: "POST",
        body: form,
      });
    },
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
    // Each competition has its own season table.
    overall: (competitionId: string) =>
      request<LeaderboardEntryDto[]>(`/api/leaderboard?competition=${encodeURIComponent(competitionId)}`),
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
    // System admin only: whether prediction reminders go out, and how many hours before each
    // week's first match (72 = 3 days).
    setReminders: (enabled: boolean, hoursBeforeFirstGame: number[]) =>
      request<ScraperSettingsDto>("/api/admin/reminders", {
        method: "PUT",
        body: JSON.stringify({ enabled, hoursBeforeFirstGame }),
      }),
    // Push notifications written by an admin ("Send push notifications").
    notifications: {
      players: () => request<NotificationPlayerDto[]>("/api/admin/notifications/players"),
      audience: (target: NotificationTarget) =>
        request<NotificationAudienceDto>("/api/admin/notifications/audience", {
          method: "POST",
          body: JSON.stringify(target),
        }),
      send: (notification: SendNotificationPayload) =>
        // targeted: players with push on (reached of them got it); inApp: everyone it went to in the app.
        request<{ targeted: number; reached: number; emailed?: number; inApp?: number }>("/api/admin/notifications", {
          method: "POST",
          body: JSON.stringify(notification),
        }),
      history: () => request<PushBroadcastDto[]>("/api/admin/notifications/history"),
    },
    // The wallet ledger ("View wallets"; changes need "Record payments").
    wallet: {
      get: (season?: string) =>
        request<AdminWalletDto>(`/api/admin/wallet${season ? `?season=${encodeURIComponent(season)}` : ""}`),
      player: (userId: string, season: string) =>
        request<PlayerLedgerDto>(
          `/api/admin/wallet/users/${encodeURIComponent(userId)}?season=${encodeURIComponent(season)}`,
        ),
      // Marks them as having paid the season's entry fee; those already paid are skipped.
      recordEntryFees: (userIds: string[], season: string, note?: string, occurredAt?: string) =>
        request<{ recorded: number; alreadyPaid: number; wallet: AdminWalletDto }>("/api/admin/wallet/entry-fees", {
          method: "POST",
          body: JSON.stringify({ userIds, season, note, occurredAt }),
        }),
      // Winnings and payouts: a positive amount. Adjustment: plus or minus, with a note.
      record: (entry: {
        userId: string;
        kind: Exclude<WalletKind, "entry_fee">;
        amountKobo: number;
        season: string;
        note?: string;
        occurredAt?: string;
      }) =>
        request<AdminWalletDto>("/api/admin/wallet/entries", { method: "POST", body: JSON.stringify(entry) }),
      // System admin only: reverses the player's entry fee for the season, taking it out of the pot.
      markUnpaid: (userId: string, season: string, reason: string) =>
        request<AdminWalletDto>(`/api/admin/wallet/users/${encodeURIComponent(userId)}/unpaid`, {
          method: "POST",
          body: JSON.stringify({ season, reason }),
        }),
      reverse: (entryId: string, reason: string) =>
        request<AdminWalletDto>(`/api/admin/wallet/entries/${encodeURIComponent(entryId)}/reverse`, {
          method: "POST",
          body: JSON.stringify({ reason }),
        }),
      // System admin only: start a new season or change the entry fee.
      updateSettings: (season: string, entryFeeKobo: number) =>
        request<AdminWalletDto>("/api/admin/wallet/settings", {
          method: "PUT",
          body: JSON.stringify({ season, entryFeeKobo }),
        }),
    },
    email: {
      status: () => request<EmailStatusDto>("/api/admin/email/status"),
      // A provider that's set up, or "auto" for the first one set up.
      setProvider: (provider: string) =>
        request<EmailStatusDto>("/api/admin/email/provider", { method: "PUT", body: JSON.stringify({ provider }) }),
      // Blank fields go back to the server's sender.
      setSenders: (senders: { senderName: string; resend: string; brevo: string; gmail: string }) =>
        request<EmailStatusDto>("/api/admin/email/senders", { method: "PUT", body: JSON.stringify(senders) }),
      test: () => request<{ message: string }>("/api/admin/email/test", { method: "POST" }),
      // Hides the failures shown so far; later ones show again.
      clearErrors: () => request<EmailStatusDto>("/api/admin/email/clear-errors", { method: "POST" }),
    },
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
    // System admin only.
    setScraperSource: (source: ScraperSourcePayload) =>
      request<ScraperSettingsDto>("/api/admin/scraper-source", {
        method: "PUT",
        body: JSON.stringify(source),
      }),
    setRegistrationClosed: (closed: boolean) =>
      request<ScraperSettingsDto>("/api/admin/registration", {
        method: "PUT",
        body: JSON.stringify({ closed }),
      }),
    competitions: {
      // Needs "Switch competitions on or off" (the system admin's unless granted).
      setEnabled: (id: string, enabled: boolean) =>
        request<CompetitionDto>(`/api/admin/competitions/${encodeURIComponent(id)}`, {
          method: "PUT",
          body: JSON.stringify({ enabled }),
        }),
      // System admin only: where each competition other than La Liga is scraped from.
      scraping: () => request<CompetitionScrapingDto[]>("/api/admin/competitions/scraping"),
      setScraperSource: (id: string, source: ScraperSourcePayload) =>
        request<CompetitionScrapingDto>(`/api/admin/competitions/${encodeURIComponent(id)}/scraper-source`, {
          method: "PUT",
          body: JSON.stringify(source),
        }),
    },
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
    // The idle sign-out time; needs "security.idle_timeout" (only the system admin by default).
    setIdleTimeout: (minutes: number) =>
      request<IdleTimeoutDto>("/api/admin/idle-timeout", { method: "PUT", body: JSON.stringify({ minutes }) }),
    // Whether a password reset also removes the account's passkeys (system admin only).
    passkeySettings: {
      get: () => request<{ removeOnPasswordReset: boolean }>("/api/admin/passkey-settings"),
      set: (removeOnPasswordReset: boolean) =>
        request<{ removeOnPasswordReset: boolean }>("/api/admin/passkey-settings", {
          method: "PUT",
          body: JSON.stringify({ removeOnPasswordReset }),
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
        request<{ user: UserSummaryDto; temporaryPassword: string | null; welcomeEmailSent?: boolean }>("/api/admin/users", {
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
      // Every player's picks, results and points for the week.
      marking: (weekId: string) =>
        request<WeekMarkingDto>(`/api/admin/weeks/${encodeURIComponent(weekId)}/marking`),
      // competition: the name shown; competitionId: whose tables the week counts towards.
      create: (name: string, competition: string, competitionId: string) =>
        request<MatchWeekDto>("/api/admin/weeks", {
          method: "POST",
          body: JSON.stringify({ name, competition, competitionId }),
        }),
      update: (id: string, name: string, competition: string, competitionId: string) =>
        request<MatchWeekDto>(`/api/admin/weeks/${encodeURIComponent(id)}`, {
          method: "PUT",
          body: JSON.stringify({ name, competition, competitionId }),
        }),
      remove: (id: string) =>
        request<{ message: string }>(`/api/admin/weeks/${encodeURIComponent(id)}`, {
          method: "DELETE",
        }),
    },
    // System admin only: the scraper's health, and a poll that re-applies every match.
    system: {
      scraperHealth: () => request<ScraperHealthDto>("/api/admin/system/scraper-health"),
      pollNow: () => request<{ message: string }>("/api/admin/system/scraper/poll-now", { method: "POST" }),
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
