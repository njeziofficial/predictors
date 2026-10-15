import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { BellOff, CheckCheck, ChevronLeft, ChevronRight, Search, Trash2, X } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import NavBar from "@/components/NavBar";
import NotificationDialog, { KindIcon } from "@/components/NotificationDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp } from "@/context/AppContext";
import { INBOX_KEY, useInboxActions } from "@/hooks/useInbox";
import { api, type InboxItemDto } from "@/lib/api";
import { getArea } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

type Filter = "all" | "unread";

const NotificationsBody = () => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState<InboxItemDto | null>(null);
  const [confirmDeleteRead, setConfirmDeleteRead] = useState(false);
  const { markRead, markAllRead, remove, removeMany, removeRead } = useInboxActions();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // A new search or filter starts again from the first page, with nothing chosen.
  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [debouncedSearch, filter]);

  const { data, isLoading, isPlaceholderData, error } = useQuery({
    queryKey: [...INBOX_KEY, { q: debouncedSearch, unreadOnly: filter === "unread", page }],
    queryFn: () =>
      api.notifications.list({ q: debouncedSearch || undefined, unreadOnly: filter === "unread", page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const items = useMemo(() => data?.items ?? [], [data]);
  const total = data?.total ?? 0;
  const unread = data?.unread ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Deleting the last ones on a page leaves it empty: step back to one that has some.
  useEffect(() => {
    if (data && !isPlaceholderData && page > totalPages) setPage(totalPages);
  }, [data, isPlaceholderData, page, totalPages]);

  // Only what's on this page can stay chosen.
  useEffect(() => {
    setSelected((current) => {
      const onPage = new Set(items.map((i) => i.id));
      const kept = [...current].filter((id) => onPage.has(id));
      return kept.length === current.size ? current : new Set(kept);
    });
  }, [items]);

  const allChosen = items.length > 0 && items.every((i) => selected.has(i.id));
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const openItem = (item: InboxItemDto) => {
    if (!item.read) markRead.mutate(item.id);
    setShown({ ...item, read: true });
  };

  const deleteSelected = () => {
    removeMany.mutate([...selected]);
    setSelected(new Set());
  };

  const searching = debouncedSearch.length > 0;

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 pb-8 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unread > 0 ? `${unread} unread` : "All caught up"} · reminders and news from the admins
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {unread > 0 && (
            <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()}>
              <CheckCheck className="mr-1.5 h-3.5 w-3.5" /> Mark all as read
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setConfirmDeleteRead(true)}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete read
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notifications"
            aria-label="Search notifications"
            className="pl-9 pr-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {items.length > 0 && (
        <div className="flex min-h-9 items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-1.5">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={allChosen ? true : selected.size > 0 ? "indeterminate" : false}
              onCheckedChange={() => setSelected(allChosen ? new Set() : new Set(items.map((i) => i.id)))}
              aria-label="Choose all on this page"
            />
            {selected.size > 0 ? `${selected.size} chosen` : "Choose all on this page"}
          </label>
          {selected.size > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={deleteSelected}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete {selected.size}
            </Button>
          )}
        </div>
      )}

      {error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-sm text-destructive">
          {error instanceof Error ? error.message : "Couldn't load your notifications."}
        </div>
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-secondary/50" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-14 text-center">
          <BellOff className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {searching
              ? `Nothing matches "${debouncedSearch}".`
              : filter === "unread"
                ? "Nothing unread."
                : "No notifications yet. Prediction reminders and news from the admins appear here."}
          </p>
        </div>
      ) : (
        <ul
          className={cn(
            "divide-y divide-border overflow-hidden rounded-lg border border-border bg-card transition-opacity",
            isPlaceholderData && "opacity-60",
          )}
        >
          {items.map((item) => (
            <li key={item.id} className={cn("flex items-start gap-3 px-3 py-3 sm:px-4", !item.read && "bg-primary/5")}>
              <Checkbox
                checked={selected.has(item.id)}
                onCheckedChange={() => toggle(item.id)}
                aria-label={`Choose "${item.title}"`}
                className="mt-1"
              />
              <span className="mt-0.5 shrink-0">
                <KindIcon kind={item.kind} />
              </span>
              <button onClick={() => openItem(item)} className="min-w-0 flex-1 text-left">
                <span className="flex items-center gap-2">
                  {!item.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                  <span className={cn("truncate text-sm", item.read ? "text-muted-foreground" : "font-semibold")}>
                    {item.title}
                  </span>
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
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {total > PAGE_SIZE && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-xs text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Prev
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      <p className="text-center text-[11px] text-muted-foreground">Notifications are deleted by themselves after 60 days.</p>

      <NotificationDialog
        item={shown}
        onClose={() => setShown(null)}
        onDelete={(item) => {
          remove.mutate(item.id);
          setShown(null);
        }}
      />

      <AlertDialog open={confirmDeleteRead} onOpenChange={setConfirmDeleteRead}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete every read notification?</AlertDialogTitle>
            <AlertDialogDescription>
              All the notifications you've read go, on every page. Unread ones stay. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => removeRead.mutate()}
            >
              Delete read
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const Notifications = () => {
  const { currentUser } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) navigate("/");
  }, [currentUser, navigate]);

  if (!currentUser) return null;

  // Admins see it inside whichever side they're using, as with Profile.
  if (currentUser.role === "admin" && getArea() === "backoffice") {
    return (
      <AdminLayout>
        <NotificationsBody />
      </AdminLayout>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8 page-transition">
      <NavBar />
      <NotificationsBody />
    </div>
  );
};

export default Notifications;
