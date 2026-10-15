import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type InboxDto } from "@/lib/api";

// Every in-app notifications query starts with this: the bell's ["inbox"] and the Notifications
// page's ["inbox", { q, unreadOnly, page }]. Invalidating it refreshes all of them.
export const INBOX_KEY = ["inbox"] as const;

type Change = { read: string[] | "all" } | { removed: string[] | "read" };

// Applied to every cached list at once, so the bell and the page agree straight away; the server
// catches up and the lists are refetched after.
const applyLocally = (queryClient: QueryClient, change: Change) =>
  queryClient.setQueriesData<InboxDto>({ queryKey: INBOX_KEY }, (inbox) => {
    if (!inbox) return inbox;
    if ("read" in change) {
      const hits = (id: string) => change.read === "all" || change.read.includes(id);
      const newlyRead = inbox.items.filter((i) => !i.read && hits(i.id)).length;
      return {
        ...inbox,
        unread: change.read === "all" ? 0 : Math.max(0, inbox.unread - newlyRead),
        items: inbox.items.map((i) => (hits(i.id) ? { ...i, read: true } : i)),
      };
    }
    const gone = (i: InboxDto["items"][number]) => (change.removed === "read" ? i.read : change.removed.includes(i.id));
    const removed = inbox.items.filter(gone);
    return {
      ...inbox,
      unread: Math.max(0, inbox.unread - removed.filter((i) => !i.read).length),
      total: Math.max(0, (inbox.total ?? inbox.items.length) - removed.length),
      items: inbox.items.filter((i) => !gone(i)),
    };
  });

/** Reading and deleting the signed-in user's in-app notifications. */
export const useInboxActions = () => {
  const queryClient = useQueryClient();
  const refetch = () => queryClient.invalidateQueries({ queryKey: INBOX_KEY });
  const failed = (fallback: string) => (err: unknown) => toast.error(err instanceof Error ? err.message : fallback);

  const markRead = useMutation({
    mutationFn: api.notifications.markRead,
    onMutate: (id) => applyLocally(queryClient, { read: [id] }),
    onSettled: refetch,
  });
  const markAllRead = useMutation({
    mutationFn: api.notifications.markAllRead,
    onMutate: () => applyLocally(queryClient, { read: "all" }),
    onSettled: refetch,
  });
  const remove = useMutation({
    mutationFn: api.notifications.remove,
    onMutate: (id) => applyLocally(queryClient, { removed: [id] }),
    onError: failed("Couldn't delete the notification."),
    onSettled: refetch,
  });
  const removeMany = useMutation({
    mutationFn: api.notifications.removeMany,
    onMutate: (ids) => applyLocally(queryClient, { removed: ids }),
    onSuccess: ({ deleted }) => toast.success(`Deleted ${deleted} ${deleted === 1 ? "notification" : "notifications"}.`),
    onError: failed("Couldn't delete those notifications."),
    onSettled: refetch,
  });
  const removeRead = useMutation({
    mutationFn: api.notifications.removeRead,
    onMutate: () => applyLocally(queryClient, { removed: "read" }),
    onSuccess: ({ deleted }) =>
      toast.success(deleted ? `Deleted ${deleted} read ${deleted === 1 ? "notification" : "notifications"}.` : "Nothing read to delete."),
    onError: failed("Couldn't delete the read notifications."),
    onSettled: refetch,
  });

  return { markRead, markAllRead, remove, removeMany, removeRead };
};
