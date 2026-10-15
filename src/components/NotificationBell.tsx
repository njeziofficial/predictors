import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCheck, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import NotificationDialog, { KindIcon } from "@/components/NotificationDialog";
import { useApp } from "@/context/AppContext";
import { INBOX_KEY, useInboxActions } from "@/hooks/useInbox";
import { api, type InboxItemDto } from "@/lib/api";
import { badgeText } from "@/lib/notificationCount";
import { clearShownNotifications } from "@/lib/push";
import { cn } from "@/lib/utils";

// The latest few; the Notifications page has the rest.
const BELL_SIZE = 10;

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

/**
 * The in-app notifications: a bell with the unread count (9+ past nine) and the latest
 * reminders and admin notifications. When there's something unread it opens by itself the
 * first time the player comes in. Tapping a notification shows it in full (and marks it read);
 * ✕ deletes it. "See all" goes to the Notifications page.
 */
const NotificationBell = ({ className }: { className?: string }) => {
  const { currentUser } = useApp();
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<InboxItemDto | null>(null);
  const { markRead, markAllRead, remove } = useInboxActions();

  const { data } = useQuery({
    queryKey: INBOX_KEY,
    queryFn: () => api.notifications.list({ pageSize: BELL_SIZE }),
    enabled: !!currentUser,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];
  const total = data?.total ?? items.length;

  // Open by itself once per session when something's waiting.
  useEffect(() => {
    if (!currentUser || unread === 0 || openedThisSession(currentUser.id)) return;
    rememberOpened(currentUser.id);
    setOpen(true);
  }, [currentUser, unread]);

  // The installed app's icon badge, where the system supports setting it (iPhone, computers).
  // On Android the launcher counts the notifications showing on the phone, so those stay until
  // everything here is read, and then go.
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    (unread > 0 ? nav.setAppBadge?.(unread) : nav.clearAppBadge?.())?.catch(() => {});
    if (data && unread === 0) void clearShownNotifications("inbox");
  }, [data, unread]);

  if (!currentUser) return null;

  const openItem = (item: InboxItemDto) => {
    if (!item.read) markRead.mutate(item.id);
    setOpen(false);
    setShown({ ...item, read: true });
  };

  const count = badgeText(unread);

  return (
    <>
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
                onClick={() => markAllRead.mutate()}
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
                      <span className="line-clamp-2 text-xs text-muted-foreground">{item.body}</span>
                      <span className="mt-1 block text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                      </span>
                    </button>
                    <button
                      onClick={() => remove.mutate(item.id)}
                      aria-label="Delete"
                      title="Delete"
                      className="self-start rounded p-0.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-border px-4 py-2.5 text-center text-xs font-medium text-primary hover:bg-secondary/50"
          >
            {total > items.length ? `See all ${total} notifications` : "See all notifications"}
          </Link>
        </PopoverContent>
      </Popover>
      <NotificationDialog
        item={shown}
        onClose={() => setShown(null)}
        onDelete={(item) => {
          remove.mutate(item.id);
          setShown(null);
        }}
      />
    </>
  );
};

export default NotificationBell;
