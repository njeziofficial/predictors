import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format, formatDistanceStrict } from "date-fns";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  CircleCheck,
  CircleX,
  Clock,
  Loader2,
  RefreshCw,
  Search,
  Server,
  Zap,
} from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { BrandLoader } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, type HealthLogEntry, type HealthPoll, type ScraperHealthDto } from "@/lib/api";
import { usePermissions } from "@/lib/permissions";

type LogFilter = "all" | "warnings" | "errors";

const at = (iso: string) => format(new Date(iso), "HH:mm:ss");
const day = (iso: string) => format(new Date(iso), "EEE d MMM, HH:mm");
/** "3 min ago" / "in 4 min", measured from the server's clock. */
const rel = (iso: string | null, now: string) => {
  if (!iso) return "never";
  const t = new Date(iso);
  const n = new Date(now);
  return t <= n ? `${formatDistanceStrict(t, n)} ago` : `in ${formatDistanceStrict(n, t)}`;
};
const secs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`);

const PHASE: Record<ScraperHealthDto["state"]["phase"], { label: string; className: string }> = {
  Starting: { label: "Starting", className: "text-muted-foreground" },
  Polling: { label: "Polling now", className: "text-primary" },
  Waiting: { label: "Waiting for next poll", className: "text-success" },
  Paused: { label: "Paused", className: "text-warning" },
  Restarting: { label: "Restarting Chrome", className: "text-destructive" },
};

const SCHEDULE: Record<NonNullable<ScraperHealthDto["state"]["schedule"]>, string> = {
  InPlay: "Match in play",
  MatchWindow: "Match window, nothing in play",
  NoMatch: "No match on",
};

const OUTCOME: Record<string, string> = {
  Ok: "text-success",
  NoMatches: "text-warning",
  Resting: "text-warning",
  Failed: "text-destructive",
  Applied: "text-success",
  Superseded: "text-muted-foreground",
};

const Section = ({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) => (
  <section className="space-y-2">
    <div>
      <h2 className="text-sm font-semibold">{title}</h2>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
    {children}
  </section>
);

const Card = ({ label, icon: Icon, children }: { label: string; icon: typeof Clock; children: ReactNode }) => (
  <div className="rounded-xl border border-border bg-card p-4">
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5" /> {label}
    </p>
    <div className="mt-1.5">{children}</div>
  </div>
);

/** A table that scrolls sideways on a phone instead of squashing. */
const Table = ({ head, children }: { head: string[]; children: ReactNode }) => (
  <div className="overflow-x-auto rounded-xl border border-border bg-card">
    <table className="w-full min-w-[640px] text-sm">
      <thead>
        <tr className="border-b border-border text-left text-xs text-muted-foreground">
          {head.map((h) => (
            <th key={h} className="px-3 py-2 font-medium">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">{children}</tbody>
    </table>
  </div>
);

const Empty = ({ cols, text }: { cols: number; text: string }) => (
  <tr>
    <td colSpan={cols} className="px-3 py-6 text-center text-xs text-muted-foreground">
      {text}
    </td>
  </tr>
);

const levelClass = (level: HealthLogEntry["level"]) =>
  level === "Error" || level === "Critical" ? "text-destructive" : level === "Warning" ? "text-warning" : "text-muted-foreground";

const AdminScraperHealth = () => {
  const { isSystemUser } = usePermissions();
  const [logFilter, setLogFilter] = useState<LogFilter>("warnings");
  const [logSearch, setLogSearch] = useState("");

  const { data, isLoading, error, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["admin-scraper-health"],
    queryFn: api.admin.system.scraperHealth,
    enabled: isSystemUser,
    refetchInterval: 10_000,
  });

  const { mutate: pollNow, isPending: polling } = useMutation({
    mutationFn: api.admin.system.pollNow,
    onSuccess: (r) => {
      toast.success(r.message);
      setTimeout(() => refetch(), 4000);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't start a poll."),
  });

  const logs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    return (data?.logs ?? []).filter(
      (l) =>
        (logFilter === "all" ||
          (logFilter === "warnings" && l.level !== "Information") ||
          (logFilter === "errors" && (l.level === "Error" || l.level === "Critical"))) &&
        (!q || `${l.category} ${l.message} ${l.exception ?? ""}`.toLowerCase().includes(q)),
    );
  }, [data?.logs, logFilter, logSearch]);

  // La Liga's: another competition's successful poll mustn't hide La Liga's failing ones.
  const competitionOf = (p: HealthPoll) => p.competition ?? "La Liga";
  const lastOk = data?.polls.find((p) => p.outcome === "Ok" && competitionOf(p) === "La Liga");
  // Only worth a label once more than one competition is being polled.
  const severalCompetitions = new Set(data?.polls.map(competitionOf)).size > 1;

  return (
    <AdminLayout systemOnly>
      <div className="mx-auto max-w-6xl space-y-6 px-4 pb-10 pt-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Activity className="h-6 w-6" /> Scraper Health
            </h1>
            <p className="text-sm text-muted-foreground">
              What the live scraper is doing on the server answering this page. Times are in your time zone.
              {dataUpdatedAt > 0 && ` Updated ${format(dataUpdatedAt, "HH:mm:ss")}, every 10 seconds.`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => pollNow()}
              disabled={polling || !data?.settings.enabled}
              title="Poll straight away and re-apply every match, changed or not"
            >
              {polling ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Zap className="mr-1.5 h-3.5 w-3.5" />}
              Poll now
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load the scraper's health."}
          </div>
        )}
        {isLoading && <BrandLoader className="h-40" />}

        {data && (
          <>
            {/* Warnings */}
            {data.warnings.length === 0 ? (
              <div className="flex items-center gap-2 rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
                <CircleCheck className="h-4 w-4 shrink-0" /> All clear: nothing needs attention.
              </div>
            ) : (
              <div className="space-y-2">
                {data.warnings.map((w, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 rounded-xl border px-4 py-3 text-sm ${
                      w.severity === "error"
                        ? "border-destructive/50 bg-destructive/10 text-destructive"
                        : "border-warning/50 bg-warning/10 text-warning"
                    }`}
                  >
                    {w.severity === "error" ? (
                      <CircleX className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    )}
                    <div>
                      <p className="font-semibold">{w.title}</p>
                      <p className="text-foreground/80">{w.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Status */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card label="Scraper" icon={Activity}>
                <p className={`text-lg font-semibold ${PHASE[data.state.phase].className}`}>{PHASE[data.state.phase].label}</p>
                <p className="text-xs text-muted-foreground">{data.state.detail ?? "—"}</p>
              </Card>
              <Card label="Next poll" icon={Clock}>
                <p className="text-lg font-semibold">
                  {data.state.nextPollAt && data.state.phase === "Waiting" ? rel(data.state.nextPollAt, data.now) : "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.state.schedule ? SCHEDULE[data.state.schedule] : "Schedule not read yet"}
                  {data.state.nextPollAt && data.state.phase === "Waiting" && ` · ${at(data.state.nextPollAt)}`}
                </p>
              </Card>
              <Card label="Last successful poll" icon={CircleCheck}>
                <p className="text-lg font-semibold">{rel(data.state.lastSuccessAt, data.now)}</p>
                <p className="text-xs text-muted-foreground">
                  {lastOk ? `${lastOk.source}: ${lastOk.matches} matches, ${lastOk.queued} changed` : "None since this server started"}
                </p>
              </Card>
              <Card label="Update queue" icon={Server}>
                <p className={`text-lg font-semibold ${data.queue.pending > 0 ? "text-warning" : ""}`}>
                  {data.queue.pending} waiting
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.queue.appliedLastHour} applied in the last hour
                  {data.queue.failedLastDay > 0 && ` · ${data.queue.failedLastDay} failed today`}
                </p>
              </Card>
            </div>

            {/* Matches */}
            <Section title="Matches around now" hint="Kicking off within 12 hours either side of now, plus anything still live.">
              <Table head={["Match", "Kickoff", "Status", "Score", "Last changed"]}>
                {data.matches.length === 0 && <Empty cols={5} text="No matches within 12 hours." />}
                {data.matches.map((m) => (
                  <tr key={m.id} className={m.problem ? "bg-destructive/10" : ""}>
                    <td className="px-3 py-2">
                      <p className="font-medium">
                        {m.homeTeam} <span className="text-muted-foreground">v</span> {m.awayTeam}
                      </p>
                      {m.problem && <p className="text-xs text-destructive">{m.problem}</p>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{day(m.kickoff)}</td>
                    <td className="px-3 py-2 capitalize">{m.status.replace("_", " ")}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-semibold tabular-nums">
                      {m.scoreHome != null ? `${m.scoreHome}-${m.scoreAway}` : "—"}
                      {m.status === "live" && m.minute != null && (
                        <span className="ml-1 text-xs font-normal text-primary">{m.minute}'</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{rel(m.updatedAt, data.now)}</td>
                  </tr>
                ))}
              </Table>
            </Section>

            {/* Polls */}
            <Section title="Recent polls" hint="Newest first. 'Changed' is how many matches differed from the last poll and were queued.">
              <Table head={["Time", "Source", "Matches", "Changed", "Took", "Result"]}>
                {data.polls.length === 0 && <Empty cols={6} text="No polls since this server started." />}
                {data.polls.slice(0, 20).map((p, i) => (
                  <tr key={i}>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{at(p.at)}</td>
                    <td className="px-3 py-2">
                      {p.source ?? <span className="text-muted-foreground">{p.plan.join(", ")}</span>}
                      {severalCompetitions && <span className="block text-xs text-muted-foreground">{competitionOf(p)}</span>}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{p.matches}</td>
                    <td className="px-3 py-2 tabular-nums">{p.queued}</td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{secs(p.durationMs)}</td>
                    <td className={`px-3 py-2 ${OUTCOME[p.outcome] ?? ""}`}>
                      {p.outcome}
                      {p.problem && <span className="block text-xs text-muted-foreground">{p.problem}</span>}
                    </td>
                  </tr>
                ))}
              </Table>
            </Section>

            {/* Sources */}
            <Section title="Sources" hint="Each site the scraper can read. Resting sources are left alone after refusing or failing.">
              <Table head={["Source", "Last success", "Last attempt", "Took", "Failures", "Resting until"]}>
                {data.sources.map((s) => (
                  <tr key={s.name} className={s.inUse ? "" : "text-muted-foreground"}>
                    <td className="px-3 py-2">
                      <span className="font-medium">{s.name}</span>
                      {s.inUse && (
                        <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">in use</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">{rel(s.lastSuccessAt, data.now)}</td>
                    <td className="px-3 py-2">
                      {s.lastAttemptAt ? rel(s.lastAttemptAt, data.now) : "never"}
                      {s.lastResult && <span className="block text-xs text-muted-foreground">{s.lastResult}</span>}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{s.lastAttemptAt ? secs(s.lastDurationMs) : "—"}</td>
                    <td className={`px-3 py-2 tabular-nums ${s.failures > 0 ? "text-warning" : ""}`}>{s.failures}</td>
                    <td className="px-3 py-2">
                      {s.coolingUntil ? (
                        <span className="text-warning">
                          {at(s.coolingUntil)}
                          {s.lastProblem && <span className="block text-xs text-muted-foreground">{s.lastProblem}</span>}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </Table>
            </Section>

            {/* Queue */}
            <Section
              title="Update queue"
              hint={`Matches that changed, waiting to be applied, then kept ${data.queue.retentionHours} hours. Last applied ${rel(
                data.queue.lastAppliedAt,
                data.now,
              )}.`}
            >
              <Table head={["#", "Match", "Reading", "Source", "Scraped", "Applied", "Outcome"]}>
                {data.queue.recent.length === 0 && <Empty cols={7} text="Nothing queued yet." />}
                {data.queue.recent.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{r.id}</td>
                    <td className="px-3 py-2">{r.fixtureId.replace(/^fs-/, "").replace(/-/g, " ")}</td>
                    <td className="whitespace-nowrap px-3 py-2">{r.reading}</td>
                    <td className="px-3 py-2">{r.source}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{at(r.scrapedAt)}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{r.processedAt ? at(r.processedAt) : "waiting"}</td>
                    <td className={`px-3 py-2 ${OUTCOME[r.outcome ?? ""] ?? "text-warning"}`}>
                      {r.outcome ?? "Pending"}
                      {r.error && <span className="block text-xs text-destructive">{r.error}</span>}
                    </td>
                  </tr>
                ))}
              </Table>
            </Section>

            {/* Points and server */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Section title="Points checks" hint="Every prediction is re-marked every 15 minutes; a finished week is then signed off.">
                <div className="space-y-3 rounded-xl border border-border bg-card p-4 text-sm">
                  <p>
                    Last check <span className="font-semibold">{rel(data.points.lastRunAt, data.now)}</span>
                    {data.points.lastRunAt && `: ${data.points.lastCorrections} corrected`}
                  </p>
                  {data.points.lastError && <p className="text-destructive">{data.points.lastError}</p>}
                  <div className="divide-y divide-border">
                    {data.points.weeks.map((w) => (
                      <div key={w.id} className="flex items-center justify-between py-1.5">
                        <span>{w.name}</span>
                        <span className={`text-xs ${w.reconciledAt ? "text-success" : "text-muted-foreground"}`}>
                          {w.reconciledAt ? `Signed off ${day(w.reconciledAt)}` : `${w.finished} of ${w.fixtures} finished`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </Section>
              <Section title="Server" hint="Restarting the server clears its polls and logs, not the queue.">
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-xl border border-border bg-card p-4 text-sm">
                  <dt className="text-muted-foreground">Started</dt>
                  <dd>
                    {day(data.process.startedAt)} ({rel(data.process.startedAt, data.now)})
                  </dd>
                  <dt className="text-muted-foreground">Version</dt>
                  <dd className="font-mono text-xs leading-5">{data.process.version ?? "unknown"}</dd>
                  <dt className="text-muted-foreground">Environment</dt>
                  <dd>{data.process.environment}</dd>
                  <dt className="text-muted-foreground">Sources</dt>
                  <dd>
                    {data.settings.mode}: {data.settings.sources.join(" → ")}
                  </dd>
                  <dt className="text-muted-foreground">Poll interval</dt>
                  <dd>{data.settings.pollIntervalSeconds}s during a match</dd>
                  <dt className="text-muted-foreground">Scraper</dt>
                  <dd className={data.settings.enabled ? "text-success" : "text-warning"}>
                    {data.settings.enabled ? "On" : "Switched off"}
                  </dd>
                </dl>
              </Section>
            </div>

            {/* Logs */}
            <Section title="Logs" hint="The app's recent log lines on this server, newest first (up to 500, cleared on restart).">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-1 rounded-lg bg-secondary p-1">
                  {(
                    [
                      ["warnings", "Warnings & errors"],
                      ["errors", "Errors"],
                      ["all", "All"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setLogFilter(value)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        logFilter === value ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="relative min-w-[160px] flex-1 sm:max-w-xs">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    placeholder="Search logs"
                    className="h-9 pl-8 text-sm"
                  />
                </div>
              </div>
              <div className="max-h-[480px] overflow-y-auto rounded-xl border border-border bg-card font-mono text-xs">
                {logs.length === 0 && <p className="p-6 text-center text-muted-foreground">No log lines match.</p>}
                {logs.map((l, i) => (
                  <div key={i} className="border-b border-border px-3 py-1.5 last:border-0">
                    <span className="text-muted-foreground">{at(l.at)}</span>{" "}
                    <span className={levelClass(l.level)}>{l.level === "Information" ? "INFO" : l.level.toUpperCase()}</span>{" "}
                    <span className="text-muted-foreground">{l.category}</span>{" "}
                    <span className="break-words">{l.message}</span>
                    {l.exception && <span className="block text-destructive">{l.exception}</span>}
                  </div>
                ))}
              </div>
            </Section>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminScraperHealth;
