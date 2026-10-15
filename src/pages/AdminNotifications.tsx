import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { BellRing, Loader2, Mail, Search, Send, ShieldAlert, Users } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { BrandMark } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useApp } from "@/context/AppContext";
import { api, type NotificationAudience, type NotificationTarget, type PushBroadcastDto } from "@/lib/api";
import { weekLabel } from "@/lib/weeks";
import { cn } from "@/lib/utils";

// Same limits as the backend's AdminNotificationsController.
const MAX_TITLE = 60;
const MAX_BODY = 200;

// Where tapping the notification opens. "custom" lets the admin type any page in the app.
const LINKS = [
  { value: "/predict", label: "Predict page" },
  { value: "/leaderboard", label: "Leaderboard" },
  { value: "/status", label: "Match status" },
  { value: "/messages", label: "Messages" },
  { value: "custom", label: "Another page…" },
];

const AUDIENCES: { value: NotificationAudience; label: string }[] = [
  { value: "everyone", label: "Everyone" },
  { value: "yet-to-predict", label: "Yet to predict" },
  { value: "selected", label: "Choose players" },
];

// A page in the app, never another site (the backend checks the same).
const isAppPath = (url: string) => url.startsWith("/") && !url.startsWith("//") && !url.includes("\\") && !/\s/.test(url);

const audienceText = (b: PushBroadcastDto) =>
  b.audience === "everyone"
    ? "Everyone"
    : b.audience === "yet-to-predict"
      ? `Yet to predict ${b.weekName ?? "a week"}`
      : "Chosen players";

const AdminNotifications = () => {
  const queryClient = useQueryClient();
  const { currentUser } = useApp();
  const isSystemUser = currentUser?.isSystemUser === true;

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("/predict");
  const [customLink, setCustomLink] = useState("/");
  const [audience, setAudience] = useState<NotificationAudience>("everyone");
  const [weekId, setWeekId] = useState("");
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [important, setImportant] = useState(false);
  const [alsoEmail, setAlsoEmail] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const { data: players = [], isLoading: loadingPlayers } = useQuery({
    queryKey: ["notification-players"],
    queryFn: api.admin.notifications.players,
  });
  const { data: weeks = [] } = useQuery({ queryKey: ["weeks"], queryFn: api.weeks.list });
  const { data: history = [], isLoading: loadingHistory } = useQuery({
    queryKey: ["notification-history"],
    queryFn: api.admin.notifications.history,
  });

  // Only weeks with a match still to play can be chased.
  const openWeeks = useMemo(
    () => weeks.filter((w) => w.fixtures.some((f) => f.status === "pre_match")),
    [weeks],
  );

  const target: NotificationTarget = {
    audience,
    weekId: audience === "yet-to-predict" ? weekId || undefined : undefined,
    userIds: audience === "selected" ? [...chosen].sort() : undefined,
    important,
    email: alsoEmail,
  };
  const targetReady =
    (audience === "everyone") || (audience === "yet-to-predict" && !!weekId) || (audience === "selected" && chosen.size > 0);

  const { data: reach, isFetching: countingReach } = useQuery({
    queryKey: ["notification-audience", target],
    queryFn: () => api.admin.notifications.audience(target),
    enabled: targetReady,
    retry: false,
  });

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? players.filter((p) => p.name.toLowerCase().includes(q) || p.whatsAppName?.toLowerCase().includes(q))
      : players;
  }, [players, search]);
  const allFilteredChosen = filteredPlayers.length > 0 && filteredPlayers.every((p) => chosen.has(p.id));

  const url = link === "custom" ? customLink.trim() : link;
  const titleText = title.trim();
  const bodyText = body.trim();
  const problems = [
    !titleText && "Add a title.",
    !bodyText && "Write the message.",
    !isAppPath(url) && "The link must be a page in the app, starting with /.",
    !targetReady && (audience === "yet-to-predict" ? "Choose the week." : "Choose at least one player."),
    targetReady &&
      reach?.willReceive === 0 &&
      !reach?.willEmail &&
      `Nobody in this audience will get it: they have notifications off${important ? "" : ", or turned off news from the admins"}.`,
    alsoEmail &&
      reach?.emailsLeftToday != null &&
      (reach.willEmail ?? 0) > reach.emailsLeftToday &&
      `That needs ${reach.willEmail} emails, but only ${reach.emailsLeftToday} more can go out today. Untick email, or send tomorrow.`,
  ].filter(Boolean) as string[];

  const { mutate: send, isPending: sending } = useMutation({
    mutationFn: () => api.admin.notifications.send({ ...target, title: titleText, body: bodyText, url }),
    onSuccess: ({ reached, targeted, emailed }) => {
      toast.success(
        `Sent. ${reached} of ${targeted} ${targeted === 1 ? "player" : "players"} got it${emailed ? `, and ${emailed} by email` : ""}.`,
      );
      setTitle("");
      setBody("");
      setImportant(false);
      queryClient.invalidateQueries({ queryKey: ["notification-history"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't send the notification."),
  });

  const toggle = (id: string) =>
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <AdminLayout permission="notifications.send">
      <div className="mx-auto max-w-2xl px-4 pt-6 pb-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">Send a push notification to players' phones.</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <BellRing className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">New notification</span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="notification-title">Title</Label>
              <span className="text-[10px] tabular-nums text-muted-foreground">{title.length}/{MAX_TITLE}</span>
            </div>
            <Input
              id="notification-title"
              value={title}
              maxLength={MAX_TITLE}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Week 9 kicks off on Friday"
              className="bg-secondary border-border"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="notification-body">Message</Label>
              <span className="text-[10px] tabular-nums text-muted-foreground">{body.length}/{MAX_BODY}</span>
            </div>
            <textarea
              id="notification-body"
              value={body}
              maxLength={MAX_BODY}
              rows={3}
              onChange={(e) => setBody(e.target.value)}
              placeholder="e.g. The Barcelona match moved to Sunday. Predictions for it stay open until kickoff."
              className="block w-full resize-none rounded-md border border-border bg-secondary px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tapping it opens</Label>
            <Select value={link} onValueChange={setLink}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LINKS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {link === "custom" && (
              <Input
                value={customLink}
                onChange={(e) => setCustomLink(e.target.value)}
                placeholder="/leaderboard"
                className="bg-secondary border-border"
                aria-label="Page in the app"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Send to</Label>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1">
              {AUDIENCES.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => setAudience(a.value)}
                  className={cn(
                    "rounded-lg py-1.5 text-xs font-medium transition-colors sm:text-sm",
                    audience === a.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {a.label}
                  {a.value === "selected" && chosen.size > 0 ? ` (${chosen.size})` : ""}
                </button>
              ))}
            </div>

            {audience === "yet-to-predict" && (
              <Select value={weekId} onValueChange={setWeekId}>
                <SelectTrigger className="bg-secondary border-border" aria-label="Week">
                  <SelectValue placeholder={openWeeks.length ? "Choose the week" : "No week has matches left to predict"} />
                </SelectTrigger>
                <SelectContent>
                  {openWeeks.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {weekLabel(w)} · {w.competition}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {audience === "selected" && (
              <div className="overflow-hidden rounded-xl border border-border">
                <div className="flex items-center gap-2 border-b border-border px-3">
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search players"
                    className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setChosen((current) => {
                        const next = new Set(current);
                        filteredPlayers.forEach((p) => (allFilteredChosen ? next.delete(p.id) : next.add(p.id)));
                        return next;
                      })
                    }
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {allFilteredChosen ? "Clear" : "Select all"}
                  </button>
                </div>
                <div className="max-h-60 overflow-y-auto p-1">
                  {loadingPlayers ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredPlayers.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">Nobody by that name.</p>
                  ) : (
                    filteredPlayers.map((p) => (
                      <label
                        key={p.id}
                        className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-secondary/60"
                      >
                        <Checkbox checked={chosen.has(p.id)} onCheckedChange={() => toggle(p.id)} />
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {p.name}
                          {p.whatsAppName && p.whatsAppName !== p.name && (
                            <span className="text-muted-foreground"> · {p.whatsAppName}</span>
                          )}
                        </span>
                        {!p.hasNotifications ? (
                          <span className="text-[10px] text-muted-foreground">Notifications off</span>
                        ) : p.mutedAnnouncements ? (
                          <span className="text-[10px] text-muted-foreground">Muted admin news</span>
                        ) : null}
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {isSystemUser && (
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <Checkbox checked={important} onCheckedChange={(v) => setImportant(v === true)} className="mt-0.5" />
              <span>
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <ShieldAlert className="h-3.5 w-3.5 text-destructive" /> Important
                </span>
                <span className="block text-xs text-muted-foreground">
                  Also send to players who turned off news from the admins. Keep it for things every player must know.
                </span>
              </span>
            </label>
          )}

          {reach && reach.emailsLeftToday !== null && reach.emailsLeftToday !== undefined && (
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-secondary/40 p-3">
              <Checkbox checked={alsoEmail} onCheckedChange={(v) => setAlsoEmail(v === true)} className="mt-0.5" />
              <span>
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <Mail className="h-3.5 w-3.5 text-primary" /> Also send by email
                </span>
                <span className="block text-xs text-muted-foreground">
                  To players in this audience with notifications off in every browser, unless they turned emails off.{" "}
                  {reach.emailsLeftToday} more {reach.emailsLeftToday === 1 ? "email" : "emails"} can go out today.
                </span>
              </span>
            </label>
          )}

          {/* Phone-style preview */}
          <div className="space-y-1.5">
            <Label>Preview</Label>
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-secondary/60 p-3 shadow-sm">
              <BrandMark className="h-9 w-9 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-semibold">{titleText || "Title"}</p>
                  <span className="shrink-0 text-[10px] text-muted-foreground">now</span>
                </div>
                <p className="line-clamp-3 text-xs text-muted-foreground">{bodyText || "Your message appears here."}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5 shrink-0" />
            {!targetReady ? (
              "Choose who to send it to."
            ) : countingReach && !reach ? (
              "Counting…"
            ) : reach ? (
              <span>
                <span className="font-medium text-foreground">{reach.willReceive}</span> of {reach.inAudience}{" "}
                {reach.inAudience === 1 ? "player" : "players"} in this audience will get it on their phone
                {alsoEmail && reach.willEmail ? (
                  <>
                    , and <span className="font-medium text-foreground">{reach.willEmail}</span> by email
                  </>
                ) : null}
                . The rest have notifications off{important ? "" : " or muted news from the admins"}.
              </span>
            ) : (
              "Couldn't count this audience."
            )}
          </div>

          {problems.length > 0 && (title || body) && <p className="text-xs text-destructive">{problems[0]}</p>}

          <Button className="w-full" disabled={problems.length > 0 || sending} onClick={() => setConfirming(true)}>
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Send notification
          </Button>
          {!isSystemUser && (
            <p className="text-center text-[11px] text-muted-foreground">You can send up to 5 notifications an hour.</p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <span className="text-sm font-semibold">Sent</span>
          {loadingHistory ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : history.length === 0 ? (
            <p className="text-xs text-muted-foreground">No notifications sent yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {history.map((b) => (
                <li key={b.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-medium">{b.title}</p>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(b.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{b.body}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {audienceText(b)} · {b.reached} of {b.targeted} reached
                    {b.emailed ? ` · ${b.emailed} emailed` : ""} · by {b.sentByName}
                    {b.important && <span className="ml-1 text-destructive">· Important</span>}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send this notification?</AlertDialogTitle>
            <AlertDialogDescription>
              "{titleText}" goes to {reach?.willReceive ?? 0} {reach?.willReceive === 1 ? "player's" : "players'"} phones
              {alsoEmail && reach?.willEmail ? ` and ${reach.willEmail} by email` : ""} straight away. It can't be taken back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => send()}>Send</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminNotifications;
