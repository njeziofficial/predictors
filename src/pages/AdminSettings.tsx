import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Loader2, Radio, Settings as SettingsIcon, BellRing, Lock, LockOpen, ShieldAlert, UserPlus, UserX, Eye, ListChecks, Power } from "lucide-react";
import { BrandLoader } from "@/components/Brand";
import { api, type WakeMode } from "@/lib/api";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DEFAULT_PREDICTION_RULES, type PredictionRules } from "@/lib/predictionRules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import AdminLayout from "@/components/AdminLayout";
import { useApp } from "@/context/AppContext";
import { usePermissions } from "@/lib/permissions";

// The scraper's Puppeteer sources are hard-coded to La Liga's pages (Flashscore/Livescore/
// BBC Sport) — this only labels the weeks it creates, so it's constrained to the one value
// that actually matches what gets scraped rather than free text that could drift out of sync.
const COMPETITIONS = ["La Liga"];

// See worker/wake.ts.
const WAKE_MODES: { value: WakeMode; label: string; help: string }[] = [
  {
    value: "matchwindows",
    label: "Match windows (recommended)",
    help: "Keeps the server awake from 30 minutes before each kickoff until the match ends (and when a reminder is due), and lets it sleep otherwise, retrying requests while it wakes. Live scores update during every match, using only a fraction of the free hours.",
  },
  {
    value: "keepalive",
    label: "Keep alive (ping)",
    help: "Pings the server every 10 minutes so it never sleeps. No waiting, and live scores keep updating when nobody has the app open, but it uses about 720-744 of the 750 free hours a month.",
  },
  {
    value: "retry",
    label: "Retry while waking",
    help: "Lets the server sleep. If a request finds it asleep, the app keeps retrying until it's up instead of showing an error. Saves free hours, but live scores only update while someone is using the app.",
  },
  {
    value: "none",
    label: "None",
    help: "No pinging and no retrying. The first requests after a sleep may fail while the server wakes up.",
  },
];

const AdminSettings = () => {
  const queryClient = useQueryClient();
  const { currentUser } = useApp();
  const { can } = usePermissions();
  const canManage = can("settings.manage");
  const canManageRules = can("predictions.rules");

  const [enabled, setEnabled] = useState(true);
  const [pollIntervalSeconds, setPollIntervalSeconds] = useState(60);
  const [competition, setCompetition] = useState("");
  const [sourceName, setSourceName] = useState("Flashscore");
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderHoursBeforeFirstGame, setReminderHoursBeforeFirstGame] = useState(24);
  const [seeded, setSeeded] = useState(false);
  const [rules, setRules] = useState<PredictionRules>(DEFAULT_PREDICTION_RULES);

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: api.admin.getSettings,
    enabled: currentUser?.role === "admin",
  });

  const { data: status } = useQuery({
    queryKey: ["admin-status"],
    queryFn: api.admin.status,
    refetchInterval: 10_000,
    enabled: currentUser?.role === "admin",
  });

  const { data: auditLogSettings } = useQuery({
    queryKey: ["audit-log-settings"],
    queryFn: api.admin.auditLogSettings.get,
    enabled: currentUser?.isSystemUser === true,
  });

  const { data: wakeConfig, error: wakeConfigError } = useQuery({
    queryKey: ["wake-config"],
    queryFn: api.admin.wakeConfig.get,
    enabled: currentUser?.isSystemUser === true,
    retry: false,
  });
  const [wakeMode, setWakeMode] = useState<WakeMode>("keepalive");
  const [retryCount, setRetryCount] = useState(12);
  useEffect(() => {
    if (!wakeConfig) return;
    setWakeMode(wakeConfig.mode);
    setRetryCount(wakeConfig.retryCount);
  }, [wakeConfig]);

  useEffect(() => {
    if (!settings || seeded) return;
    setEnabled(settings.enabled);
    setPollIntervalSeconds(settings.pollIntervalSeconds);
    setCompetition(settings.competition);
    setSourceName(settings.sourceName);
    setReminderEnabled(settings.reminderEnabled);
    setReminderHoursBeforeFirstGame(settings.reminderHoursBeforeFirstGame);
    setSeeded(true);
  }, [settings, seeded]);

  // Follows the saved rules (including another admin's change pushed live) until edited here.
  const [rulesDirty, setRulesDirty] = useState(false);
  useEffect(() => {
    if (settings?.predictionRules && !rulesDirty) setRules(settings.predictionRules);
  }, [settings, rulesDirty]);

  const setRule = (key: keyof PredictionRules, value: boolean) => {
    setRules((prev) => ({ ...prev, [key]: value }));
    setRulesDirty(true);
  };

  const { mutate: saveRules, isPending: isSavingRules } = useMutation({
    mutationFn: () => api.admin.setPredictionRules(rules),
    onSuccess: (saved) => {
      queryClient.setQueryData(["admin-settings"], saved);
      queryClient.invalidateQueries({ queryKey: ["predictions-lock-status"] });
      setRulesDirty(false);
      toast.success("Prediction rules saved.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to save prediction rules.");
    },
  });

  const { mutate: save, isPending: isSaving } = useMutation({
    mutationFn: () =>
      api.admin.updateSettings({
        enabled,
        pollIntervalSeconds,
        competition,
        sourceName,
        reminderEnabled,
        reminderHoursBeforeFirstGame,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-status"] });
      toast.success("Settings saved.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to save settings.");
    },
  });

  const { mutate: setLock, isPending: isLocking } = useMutation({
    mutationFn: (locked: boolean) => api.admin.setPredictionsLock(locked),
    onSuccess: (_, locked) => {
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-status"] });
      toast.success(locked ? "Predictions locked for everyone." : "Predictions unlocked.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update the predictions lock.");
    },
  });

  const { mutate: setRegistrationClosed, isPending: isSettingRegistration } = useMutation({
    mutationFn: (closed: boolean) => api.admin.setRegistrationClosed(closed),
    onSuccess: (_, closed) => {
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-status"] });
      queryClient.invalidateQueries({ queryKey: ["registration-status"] });
      toast.success(closed ? "Registration closed." : "Registration reopened.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update registration.");
    },
  });

  const { mutate: setAuditLogEnabled, isPending: isSavingAuditLog } = useMutation({
    mutationFn: (enabled: boolean) => api.admin.auditLogSettings.set(enabled),
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["audit-log-settings"] });
      toast.success(enabled ? "Audit logging turned back on." : "Audit logging turned off.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update audit logging.");
    },
  });

  const { mutate: saveWakeConfig, isPending: isSavingWakeConfig } = useMutation({
    mutationFn: () => api.admin.wakeConfig.set(wakeMode, retryCount),
    onSuccess: (saved) => {
      queryClient.setQueryData(["wake-config"], saved);
      toast.success("Server wake-up setting saved. It reaches every server location within about a minute.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to save the server wake-up setting.");
    },
  });

  if (isLoading) {
    return (
      <AdminLayout permission="settings.view">
        <BrandLoader className="h-64" />
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout permission="settings.view">
        <div className="mx-auto max-w-2xl px-4 pt-12">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
            <p className="text-sm text-destructive font-medium">Failed to load admin settings</p>
            <p className="text-xs text-destructive/80 mt-1">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const intervalValid = pollIntervalSeconds >= 15 && pollIntervalSeconds <= 3600;
  const competitionValid = competition.trim().length > 0;
  const reminderHoursValid = reminderHoursBeforeFirstGame >= 1 && reminderHoursBeforeFirstGame <= 336;
  const canSave = intervalValid && competitionValid && reminderHoursValid && !isSaving;

  const retryDelay = wakeConfig?.retryDelaySeconds ?? 5;
  const retryCountValid = Number.isInteger(retryCount) && retryCount >= 1 && retryCount <= (wakeConfig?.maxRetryCount ?? 30);
  const wakeConfigDirty = !!wakeConfig && (wakeMode !== wakeConfig.mode || retryCount !== wakeConfig.retryCount);
  // Modes that let the server sleep and retry requests while it wakes.
  const usesRetry = wakeMode === "retry" || wakeMode === "matchwindows";
  const wakeSchedule = wakeConfig?.schedule;

  return (
    <AdminLayout permission="settings.view">
      <div className="mx-auto max-w-2xl px-4 pt-6 pb-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground">Configure the live score scraper</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Scraper status</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">State</span>
            <span
              className={`text-xs px-2 py-0.5 rounded font-medium ${
                status?.scraperEnabled ? "bg-success/20 text-success" : "bg-secondary text-muted-foreground"
              }`}
            >
              {status?.scraperEnabled ? "Running" : "Paused"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Last scraped</span>
            <span>
              {status?.lastScrapedAt
                ? formatDistanceToNow(new Date(status.lastScrapedAt), { addSuffix: true })
                : "Never"}
            </span>
          </div>
        </div>

        {/* Its own permission, so it sits outside the settings.manage fieldset below. */}
        <fieldset disabled={!canManageRules} className="min-w-0 rounded-xl border border-border bg-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Prediction rules</span>
          </div>

          {!canManageRules && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
              <Eye className="h-3.5 w-3.5 shrink-0" />
              View only. Only the system admin, or admins given "Change prediction rules", can change these.
            </div>
          )}

          {(
            [
              {
                key: "allowPartialPredictions",
                label: "Allow incomplete predictions",
                help: "Off: players must predict every match still open in the week before they can submit. On: they can submit any number, and are warned that their predictions are incomplete.",
              },
              {
                key: "predictionsFinal",
                label: "Predictions are final",
                help: "Once a player submits a prediction it can never be changed. They're shown a clear warning before submitting. If incomplete predictions are allowed, matches they skipped can still be predicted while open.",
              },
              {
                key: "lockWeekAtFirstKickoff",
                label: "Lock the whole week at first kickoff",
                help: "As soon as the week's first match starts, every prediction for that week is locked, including matches yet to play. Off: each match locks at its own kickoff.",
              },
              {
                key: "allowLatePredictions",
                label: "Allow late predictions",
                help: "Players who hadn't predicted anything when the week locked can still predict the matches yet to start, in one submission. Only applies while the week locks at first kickoff.",
                disabled: !rules.lockWeekAtFirstKickoff,
              },
            ] as { key: keyof PredictionRules; label: string; help: string; disabled?: boolean }[]
          ).map((r) => (
            <div key={r.key} className="flex items-start justify-between gap-4">
              <div>
                <Label htmlFor={`rule-${r.key}`} className={r.disabled ? "text-muted-foreground" : ""}>
                  {r.label}
                </Label>
                <p className="text-xs text-muted-foreground">{r.help}</p>
              </div>
              <Switch
                id={`rule-${r.key}`}
                checked={rules[r.key]}
                onCheckedChange={(v) => setRule(r.key, v)}
                disabled={r.disabled}
              />
            </div>
          ))}

          {canManageRules && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="w-full" disabled={!rulesDirty || isSavingRules}>
                  {isSavingRules && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save prediction rules
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Apply prediction rules?</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                      <li>
                        {rules.allowPartialPredictions
                          ? "Players may submit incomplete predictions."
                          : "Players must predict every open match."}
                      </li>
                      <li>
                        {rules.predictionsFinal
                          ? "Submitted predictions can never be changed."
                          : "Players can change predictions until they lock."}
                      </li>
                      <li>
                        {rules.lockWeekAtFirstKickoff
                          ? "The whole week locks when its first match kicks off."
                          : "Each match locks at its own kickoff."}
                      </li>
                      {rules.lockWeekAtFirstKickoff && (
                        <li>
                          {rules.allowLatePredictions
                            ? "Players who hadn't predicted may still predict matches yet to start."
                            : "Players who hadn't predicted miss the whole week."}
                        </li>
                      )}
                      <li>This applies to every player straight away, including weeks already in progress.</li>
                    </ul>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => saveRules()}>Apply</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </fieldset>

        {!canManage && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
            <Eye className="h-3.5 w-3.5 shrink-0" />
            View only. Your permissions don't include changing settings.
          </div>
        )}

        {/* A disabled fieldset disables every control inside it for view-only admins. */}
        <fieldset disabled={!canManage} className="min-w-0 space-y-6">
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Scraper settings</span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="scraper-enabled">Enabled</Label>
              <p className="text-xs text-muted-foreground">Pause to stop polling without redeploying</p>
            </div>
            <Switch id="scraper-enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="poll-interval">Poll interval (seconds)</Label>
            <Input
              id="poll-interval"
              type="number"
              min={15}
              max={3600}
              value={pollIntervalSeconds}
              onChange={(e) => setPollIntervalSeconds(Number(e.target.value))}
              className="bg-secondary border-border"
            />
            {!intervalValid && <p className="text-xs text-destructive">Must be between 15 and 3600 seconds.</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="competition">Competition</Label>
            <Select value={competition} onValueChange={setCompetition}>
              <SelectTrigger id="competition" className="bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMPETITIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Only La Liga is currently supported by the live scraper.</p>
            {!competitionValid && <p className="text-xs text-destructive">Required.</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="source">Live score source</Label>
            <Select value={sourceName} onValueChange={setSourceName}>
              <SelectTrigger id="source" className="bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(settings?.availableSources ?? [sourceName]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Only one source is scraped at a time — no fallback between sites. Flashscore is required to create
              new match weeks; the others are score/status fallbacks and best used only if Flashscore is blocked.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Predictions</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">State</span>
            <span
              className={`text-xs px-2 py-0.5 rounded font-medium ${
                settings?.predictionsLocked ? "bg-destructive/20 text-destructive" : "bg-success/20 text-success"
              }`}
            >
              {settings?.predictionsLocked ? "Locked" : "Open"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Locking stops every user from submitting or changing predictions immediately, regardless of each
            week's kickoff countdown. This takes effect right away — it doesn't require saving settings below.
          </p>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant={settings?.predictionsLocked ? "outline" : "destructive"}
                className="w-full"
                disabled={isLocking}
              >
                {isLocking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {settings?.predictionsLocked ? (
                  <>
                    <LockOpen className="h-4 w-4 mr-2" /> Unlock predictions
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" /> Lock all predictions
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {settings?.predictionsLocked ? "Unlock predictions?" : "Lock all predictions?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {settings?.predictionsLocked
                    ? "Users will be able to submit or change predictions again, subject to each week's normal kickoff lock."
                    : "No user will be able to submit or change a prediction until you unlock this, even for weeks that haven't kicked off yet."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => setLock(!settings?.predictionsLocked)}>
                  {settings?.predictionsLocked ? "Unlock" : "Lock"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Registration</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">State</span>
            <span
              className={`text-xs px-2 py-0.5 rounded font-medium ${
                settings?.registrationClosed ? "bg-destructive/20 text-destructive" : "bg-success/20 text-success"
              }`}
            >
              {settings?.registrationClosed ? "Closed" : "Open"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Closing registration stops new people from signing up. Existing users can still log in and predict, and
            the system user can still create accounts from the Users page. This takes effect right away.
          </p>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant={settings?.registrationClosed ? "outline" : "destructive"}
                className="w-full"
                disabled={isSettingRegistration || !settings}
              >
                {isSettingRegistration && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {settings?.registrationClosed ? (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" /> Reopen registration
                  </>
                ) : (
                  <>
                    <UserX className="h-4 w-4 mr-2" /> Close registration
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {settings?.registrationClosed ? "Reopen registration?" : "Close registration?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {settings?.registrationClosed
                    ? "Anyone with the link will be able to create an account again."
                    : "The sign-up page will be closed to new users until you reopen it. Existing accounts are not affected."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => setRegistrationClosed(!settings?.registrationClosed)}>
                  {settings?.registrationClosed ? "Reopen" : "Close"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {currentUser?.isSystemUser && (
          <div className="rounded-xl border border-destructive/30 bg-card p-4 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              <span className="text-sm font-semibold">Audit log</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-destructive/20 text-destructive">
                System user only
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">State</span>
              <span
                className={`text-xs px-2 py-0.5 rounded font-medium ${
                  auditLogSettings?.enabled ?? true
                    ? "bg-success/20 text-success"
                    : "bg-destructive/20 text-destructive"
                }`}
              >
                {(auditLogSettings?.enabled ?? true) ? "Logging" : "Off"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Turning this off stops every new entry — logins, profile edits, role/status changes, password
              resets, everything — from being written anywhere. Nothing already logged is deleted, but nothing
              new is recorded until this is switched back on. Use it if the audit table is growing out of
              proportion.
            </p>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant={(auditLogSettings?.enabled ?? true) ? "destructive" : "outline"}
                  className="w-full"
                  disabled={isSavingAuditLog}
                >
                  {isSavingAuditLog && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {(auditLogSettings?.enabled ?? true) ? "Turn off audit logging" : "Turn audit logging back on"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {(auditLogSettings?.enabled ?? true) ? "Turn off audit logging?" : "Turn audit logging back on?"}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {(auditLogSettings?.enabled ?? true)
                      ? "From this point on, nothing will be recorded to the audit log for anyone, including other admins, until you turn it back on."
                      : "New actions will start being recorded to the audit log again. Nothing that happened while it was off can be recovered."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => setAuditLogEnabled(!(auditLogSettings?.enabled ?? true))}>
                    {(auditLogSettings?.enabled ?? true) ? "Turn off" : "Turn on"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {currentUser?.isSystemUser && (
          <div className="rounded-xl border border-destructive/30 bg-card p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Power className="h-4 w-4 text-destructive" />
              <span className="text-sm font-semibold">Server wake-up</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-destructive/20 text-destructive">
                System user only
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Render's free plan puts the backend to sleep after 15 minutes without visitors, and waking it takes
              about a minute. Choose how the app deals with that. This takes effect right away; it doesn't require
              saving settings below.
            </p>

            {wakeConfigError ? (
              <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
                Couldn't load this setting: {wakeConfigError instanceof Error ? wakeConfigError.message : "unknown error"}.
                It's handled by the Cloudflare Worker, so it's only available on the deployed site.
              </div>
            ) : (
              <>
                <RadioGroup value={wakeMode} onValueChange={(v) => setWakeMode(v as WakeMode)} className="gap-3">
                  {WAKE_MODES.map((m) => (
                    <div key={m.value} className="flex items-start gap-3">
                      <RadioGroupItem value={m.value} id={`wake-${m.value}`} className="mt-0.5" />
                      <div>
                        <Label htmlFor={`wake-${m.value}`}>{m.label}</Label>
                        <p className="text-xs text-muted-foreground">{m.help}</p>
                      </div>
                    </div>
                  ))}
                </RadioGroup>

                {wakeMode === "matchwindows" && (
                  <div className="rounded-lg border border-border bg-secondary/50 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
                    {!wakeSchedule ? (
                      <p>The match schedule hasn't been fetched yet. It will be when you save.</p>
                    ) : (
                      <>
                        <p>
                          {wakeSchedule.inWindow
                            ? "A match window is on now: the server is being kept awake."
                            : "No match on now: the server is allowed to sleep."}
                        </p>
                        {wakeSchedule.nextWindow && (
                          <p>
                            {wakeSchedule.inWindow ? "This window" : "Next window"}:{" "}
                            {format(new Date(wakeSchedule.nextWindow.start), "EEE d MMM, HH:mm")} –{" "}
                            {format(new Date(wakeSchedule.nextWindow.end), "HH:mm")}
                          </p>
                        )}
                        <p>
                          Schedule checked {formatDistanceToNow(new Date(wakeSchedule.fetchedAt), { addSuffix: true })}.
                        </p>
                      </>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="wake-retry-count" className={!usesRetry ? "text-muted-foreground" : ""}>
                    Retry count
                  </Label>
                  <Input
                    id="wake-retry-count"
                    type="number"
                    min={1}
                    max={wakeConfig?.maxRetryCount ?? 30}
                    value={retryCount}
                    onChange={(e) => setRetryCount(Number(e.target.value))}
                    className="bg-secondary border-border"
                    disabled={!usesRetry}
                  />
                  {retryCountValid ? (
                    <p className="text-xs text-muted-foreground">
                      Tries again every {retryDelay}s, so a request waits up to about {retryCount * retryDelay}s for the
                      server to wake before showing an error.
                      {retryCount * retryDelay < 60 && " Render usually needs about 60s, so this may be too short."}
                    </p>
                  ) : (
                    <p className="text-xs text-destructive">Must be a whole number from 1 to {wakeConfig?.maxRetryCount ?? 30}.</p>
                  )}
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      className="w-full"
                      disabled={!wakeConfig || !retryCountValid || !wakeConfigDirty || isSavingWakeConfig}
                    >
                      {isSavingWakeConfig && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Save server wake-up
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Switch to "{WAKE_MODES.find((m) => m.value === wakeMode)?.label}"?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {wakeMode === "matchwindows"
                          ? `The server will be kept awake from 30 minutes before each kickoff until the match ends, and once a day briefly to find new fixtures. Otherwise it sleeps, and the first visitor waits up to about ${retryCount * retryDelay}s while it wakes.`
                          : wakeMode === "keepalive"
                          ? "The server will be pinged every 10 minutes and never sleep. This uses nearly all of Render's 750 free hours each month, so don't run another free service in the same Render workspace."
                          : wakeMode === "retry"
                            ? `The server will sleep when nobody is using the app, and live scores won't update until someone opens it. The first visitor after a sleep waits up to about ${retryCount * retryDelay}s while it wakes.`
                            : "The server will sleep when nobody is using the app, and live scores won't update until someone opens it. The first requests after a sleep may fail with an error while it wakes."}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => saveWakeConfig()}>Apply</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <BellRing className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Prediction reminders</span>
          </div>

          {reminderEnabled && status && !status.remindersConfigured && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
              Twilio isn't configured yet (missing AccountSid/AuthToken in the backend's
              appsettings.json) — reminders are on but nothing will actually send until that's set.
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="reminder-enabled">Enabled</Label>
              <p className="text-xs text-muted-foreground">Send all non-admin users a reminder to predict</p>
            </div>
            <Switch id="reminder-enabled" checked={reminderEnabled} onCheckedChange={setReminderEnabled} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reminder-hours">Hours before the week's first match</Label>
            <Input
              id="reminder-hours"
              type="number"
              min={1}
              max={336}
              value={reminderHoursBeforeFirstGame}
              onChange={(e) => setReminderHoursBeforeFirstGame(Number(e.target.value))}
              className="bg-secondary border-border"
              disabled={!reminderEnabled}
            />
            {!reminderHoursValid && <p className="text-xs text-destructive">Must be between 1 and 336 hours.</p>}
          </div>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button className="w-full" disabled={!canSave}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save settings
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Apply settings?</AlertDialogTitle>
              <AlertDialogDescription>
                Polling every {pollIntervalSeconds}s for {competition}.{" "}
                {enabled ? (
                  settings && !settings.enabled
                    ? "This resumes live score syncing for all users."
                    : "Live score syncing stays on for all users."
                ) : (
                  "This pauses live score syncing for all users — scores and match status will stop updating until it's re-enabled."
                )}{" "}
                {reminderEnabled
                  ? `Reminders will go out ${reminderHoursBeforeFirstGame}h before each week's first match.`
                  : "Prediction reminders stay off."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => save()}>Apply</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </fieldset>
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;
