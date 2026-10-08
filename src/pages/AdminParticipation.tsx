import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  MessageCircle,
  Phone,
  Copy,
  Check,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  Lock,
  Users,
  Search,
} from "lucide-react";
import { BrandLoader } from "@/components/Brand";
import { api, type PlayerParticipationDto } from "@/lib/api";
import { whatsAppLink } from "@/lib/phone";
import { activeWeek, sortWeeks } from "@/lib/weeks";
import AdminLayout from "@/components/AdminLayout";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Status = "missing" | "partial" | "done";
type Filter = Status | "all";

const STATUS = {
  missing: { label: "Not predicted", icon: CircleAlert, className: "bg-destructive/15 text-destructive" },
  partial: { label: "Incomplete", icon: CircleDashed, className: "bg-warning/15 text-warning" },
  done: { label: "Predicted", icon: CircleCheck, className: "bg-success/15 text-success" },
} as const;

// Predictions lock 30 seconds before the first remaining kickoff (same rule as the Predict page).
const LOCK_LEAD_MS = 30_000;

const shortWeek = (name: string) => name.replace(/.*—\s*/, "");
const displayName = (p: PlayerParticipationDto) => p.whatsAppName || p.name;

const AdminParticipation = () => {
  const { currentUser } = useApp();
  const isAdmin = currentUser?.role === "admin";
  const [pickedWeekId, setPickedWeekId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("missing");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);

  const { data: weeks = [], isLoading: weeksLoading } = useQuery({
    queryKey: ["weeks"],
    queryFn: api.weeks.list,
    enabled: isAdmin,
  });
  const sortedWeeks = useMemo(() => sortWeeks(weeks).reverse(), [weeks]);
  const weekId = pickedWeekId ?? activeWeek(weeks)?.id ?? null;

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-participation", weekId],
    queryFn: () => api.admin.weeks.participation(weekId!),
    enabled: isAdmin && !!weekId,
    refetchInterval: 60_000,
  });

  const players = useMemo(() => {
    if (!data) return [];
    const statusOf = (p: PlayerParticipationDto): Status =>
      p.predicted === 0 ? "missing" : p.predicted < data.fixtureCount ? "partial" : "done";
    const order: Record<Status, number> = { missing: 0, partial: 1, done: 2 };
    return data.players
      .map((p) => ({ ...p, status: statusOf(p) }))
      .sort((a, b) => order[a.status] - order[b.status] || displayName(a).localeCompare(displayName(b)));
  }, [data]);

  const counts = { missing: 0, partial: 0, done: 0 };
  players.forEach((p) => counts[p.status]++);
  const chase = players.filter((p) => p.status !== "done");

  const lockAt = data?.nextKickoff ? new Date(new Date(data.nextKickoff).getTime() - LOCK_LEAD_MS) : null;
  const locked = !lockAt || lockAt.getTime() <= Date.now();
  const deadline = lockAt ? format(lockAt, "EEE d MMM, HH:mm") : null;

  const query = search.trim().toLowerCase();
  const visible = players.filter(
    (p) =>
      (filter === "all" || p.status === filter) &&
      (!query || [p.name, p.whatsAppName, p.email].some((v) => v?.toLowerCase().includes(query))),
  );

  const personalMessage = (p: PlayerParticipationDto) => {
    const week = data ? shortWeek(data.weekName) : "this week";
    const what =
      p.predicted === 0
        ? `you haven't made your predictions for ${week} yet`
        : `you've predicted ${p.predicted} of ${data?.fixtureCount} matches for ${week}`;
    return `Hi ${displayName(p)}, a quick reminder from Octopus Prediction: ${what}.${
      deadline && !locked ? ` Predictions lock ${deadline}.` : ""
    } Don't miss out! ⚽`;
  };

  const copyGroupReminder = async () => {
    if (!data) return;
    const lines = [
      `⚽ *Octopus Prediction — ${shortWeek(data.weekName)}*`,
      "",
      `Yet to predict (${chase.length}):`,
      ...chase.map((p, i) => `${i + 1}. ${displayName(p)}${p.status === "partial" ? ` (${p.predicted}/${data.fixtureCount})` : ""}`),
      "",
      deadline && !locked ? `Predictions lock ${deadline}. Don't miss out!` : "Don't miss out!",
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      toast.success("Reminder copied. Paste it in the WhatsApp group.");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Couldn't copy to the clipboard.");
    }
  };

  const total = players.length;
  const pct = total > 0 ? Math.round((counts.done / total) * 100) : 0;

  return (
    <AdminLayout permission="participation.view">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-8 pb-10 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Prediction Check</h1>
            <p className="text-sm text-muted-foreground">
              See who hasn't predicted a week yet and remind them before it locks.
            </p>
          </div>
          <Select value={weekId ?? undefined} onValueChange={setPickedWeekId} disabled={weeksLoading}>
            <SelectTrigger className="w-full sm:w-[240px]">
              <SelectValue placeholder="Choose a week" />
            </SelectTrigger>
            <SelectContent>
              {sortedWeeks.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load the week."}
          </div>
        )}

        {(isLoading || weeksLoading) && (
          <BrandLoader className="h-40" />
        )}

        {data && (
          <>
            {/* Summary */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> Predicted
                </p>
                <p className="mt-1.5 text-2xl font-bold tabular-nums">
                  {counts.done}
                  <span className="text-base font-medium text-muted-foreground"> / {total}</span>
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div
                className={`rounded-xl border p-4 ${
                  chase.length > 0 && !locked ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"
                }`}
              >
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CircleAlert className="h-3.5 w-3.5" /> Yet to predict
                </p>
                <p className={`mt-1.5 text-2xl font-bold tabular-nums ${chase.length > 0 ? "text-destructive" : ""}`}>
                  {chase.length}
                </p>
                <p className="text-xs text-muted-foreground">
                  {counts.missing} not started{counts.partial > 0 && ` · ${counts.partial} incomplete`}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" /> Deadline
                </p>
                {locked ? (
                  <>
                    <p className="mt-1.5 text-lg font-semibold">Locked</p>
                    <p className="text-xs text-muted-foreground">Matches have started; showing the final picture.</p>
                  </>
                ) : (
                  <>
                    <p className="mt-1.5 text-lg font-semibold">
                      {formatDistanceToNow(lockAt!, { addSuffix: false })} left
                    </p>
                    <p className="text-xs text-muted-foreground">Locks {deadline}</p>
                  </>
                )}
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-secondary p-1 [scrollbar-width:none]">
                {(
                  [
                    ["missing", `Not predicted · ${counts.missing}`],
                    ["partial", `Incomplete · ${counts.partial}`],
                    ["done", `Predicted · ${counts.done}`],
                    ["all", `All · ${total}`],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setFilter(value)}
                    className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      filter === value ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="relative min-w-[160px] flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search players"
                  className="h-9 pl-8 text-sm"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto"
                disabled={chase.length === 0}
                onClick={copyGroupReminder}
              >
                {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                Copy group reminder
              </Button>
            </div>

            {/* Players */}
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {visible.length === 0 && (
                <div className="p-10 text-center">
                  <CircleCheck className="mx-auto mb-2 h-8 w-8 text-success opacity-80" />
                  <p className="text-sm text-muted-foreground">
                    {filter === "missing" || filter === "partial"
                      ? "Nobody here. Everyone's in for this week."
                      : "No players match."}
                  </p>
                </div>
              )}
              {visible.map((p) => {
                const s = STATUS[p.status];
                const wa = whatsAppLink(p.phoneNumber, personalMessage(p));
                return (
                  <div key={p.userId} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold">{displayName(p)}</p>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${s.className}`}
                        >
                          <s.icon className="h-3 w-3" />
                          {p.status === "partial" ? `${p.predicted} of ${data.fixtureCount}` : s.label}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {p.whatsAppName && p.whatsAppName !== p.name && `${p.name} · `}
                        {p.phoneNumber || "No phone number"}
                        {" · "}
                        {p.status === "done" && p.submittedAt
                          ? `Submitted ${format(new Date(p.submittedAt), "EEE HH:mm")}`
                          : p.lastLoginAt
                            ? `Last seen ${formatDistanceToNow(new Date(p.lastLoginAt), { addSuffix: true })}`
                            : "Never signed in"}
                      </p>
                    </div>
                    {p.status !== "done" && (
                      <div className="flex shrink-0 gap-2">
                        <Button
                          asChild={!!wa}
                          size="sm"
                          disabled={!wa}
                          className="bg-[#25D366] text-[#06281a] hover:bg-[#25D366]/90"
                          title={wa ? "Open WhatsApp with a reminder ready to send" : "No phone number on file"}
                        >
                          {wa ? (
                            <a href={wa} target="_blank" rel="noreferrer">
                              <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> Remind
                            </a>
                          ) : (
                            <span>
                              <MessageCircle className="mr-1.5 inline h-3.5 w-3.5" /> Remind
                            </span>
                          )}
                        </Button>
                        {p.phoneNumber && (
                          <Button asChild size="sm" variant="outline" title={`Call ${p.phoneNumber}`}>
                            <a href={`tel:${p.phoneNumber.replace(/\s/g, "")}`}>
                              <Phone className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminParticipation;
