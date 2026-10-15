import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Bell, BellRing, CheckCheck, Megaphone, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useApp } from "@/context/AppContext";
import { api, type InboxDto, type InboxItemDto } from "@/lib/api";
import { badgeText } from "@/lib/notificationCount";
import { cn } from "@/lib/utils";

const INBOX_KEY = ["inbox"];

// Shown once per sign-in session when there's something unread: the list opens by itself.
const OPENED_KEY = "op_inbox_opened";
const openedThisSession = (userId: string) => {
  try {
    return sessionStorage.getItem(OPENED_KEY) === userId;
  } catch {
    return true;
  }
};
const rememberOpened = (userId: string) => {
  try {
    sessionStorage.setItem(OPENED_KEY, userId);
  } catch {
    // Storage unavailable: it opens again next page load, nothing worse.
  }
};

const KindIcon = ({ kind }: { kind: InboxItemDto["kind"] }) =>
  kind === "announcement" ? (
    <Megaphone className="h-4 w-4 text-primary" />
  ) : (
    <BellRing className="h-4 w-4 text-primary" />
  );

/**
 * The in-app notifications: a bell with the unread count (9+ past nine) and the latest
 * reminders and admin notifications. When there's something unread it opens by itself the
 * first time the player comes in. Opening a notification goes to its page; opening it or
 * dismissing it with ✕ marks it read, which lowers the count.
 */
const NotificationBell = ({ className }: { className?: string }) => {
  const { currentUser } = useApp();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: INBOX_KEY,
    queryFn: api.notifications.list,
    enabled: !!currentUser,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];

  // Open by itself once per session when something's waiting.
  useEffect(() => {
    if (!currentUser || unread === 0 || openedThisSession(currentUser.id)) return;
    rememberOpened(currentUser.id);
    setOpen(true);
  }, [currentUser, unread]);

  // The installed app's icon badge, where the system supports setting it (iPhone, computers).
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    (unread > 0 ? nav.setAppBadge?.(unread) : nav.clearAppBadge?.())?.catch(() => {});
  }, [unread]);

  // Marked read straight away on screen; the server catches up.
  const markLocally = (ids: string[] | "all") =>
    queryClient.setQueryData<InboxDto>(INBOX_KEY, (inbox) => {
      if (!inbox) return inbox;
      const items = inbox.items.map((i) => (ids === "all" || ids.includes(i.id) ? { ...i, read: true } : i));
      const newlyRead = inbox.items.filter((i) => !i.read && (ids === "all" || ids.includes(i.id))).length;
      return { unread: ids === "all" ? 0 : Math.max(0, inbox.unread - newlyRead), items };
    });

  const { mutate: markRead } = useMutation({
    mutationFn: api.notifications.markRead,
    onMutate: (id) => markLocally([id]),
    onSettled: () => queryClient.invalidateQueries({ queryKey: INBOX_KEY }),
  });
  const { mutate: markAllRead } = useMutation({
    mutationFn: api.notifications.markAllRead,
    onMutate: () => markLocally("all"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: INBOX_KEY }),
  });

  if (!currentUser) return null;

  const openItem = (item: InboxItemDto) => {
    if (!item.read) markRead(item.id);
    setOpen(false);
    navigate(item.url || "/");
  };

  const count = badgeText(unread);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label={count ? `Notifications, ${unread} unread` : "Notifications"}
          className={cn("relative p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors", className)}
        >
          <Bell className="h-4 w-4" />
          {count && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
              {count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 && (
            <button
              onClick={() => markAllRead()}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all as read
            </button>
          )}
        </div>
        <div className="max-h-[min(24rem,60vh)] overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              No notifications yet. Prediction reminders and news from the admins appear here.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.id} className={cn("relative flex gap-3 px-4 py-3", !item.read && "bg-primary/5")}>
                  <span className="mt-0.5 shrink-0">
                    <KindIcon kind={item.kind} />
                  </span>
                  <button onClick={() => openItem(item)} className="min-w-0 flex-1 text-left">
                    <span className={cn("block text-sm", item.read ? "text-muted-foreground" : "font-semibold")}>
                      {item.title}
                    </span>
                    <span className="block text-xs text-muted-foreground">{item.body}</span>
                    <span className="mt-1 block text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </span>
                  </button>
                  {!item.read && (
                    <button
                      onClick={() => markRead(item.id)}
                      aria-label="Dismiss"
                      title="Dismiss"
                      className="self-start rounded p-0.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
