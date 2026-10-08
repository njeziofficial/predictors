import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  Ban,
  Check,
  CheckCheck,
  Clock,
  Copy,
  Loader2,
  Megaphone,
  MoreHorizontal,
  SendHorizontal,
  Trash2,
  WifiOff,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import { useChat } from "@/context/ChatContext";
import { api, type ConversationDto } from "@/lib/api";
import {
  applyMessageToConversations,
  applyReadReceipt,
  chatKeys,
  continuesGroup,
  dayLabel,
  flattenMessages,
  MAX_MESSAGE_LENGTH,
  newClientId,
  splitLinks,
  startsNewDay,
  upsertMessage,
  type LocalMessage,
  type MessagePages,
} from "@/lib/chat";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import ChatAvatar, { AdminBadge } from "./ChatAvatar";

// Unsent text per conversation, kept while you hop between chats (cleared on reload).
const drafts = new Map<string, string>();

const NEAR_BOTTOM_PX = 120;

const MessageText = ({ text }: { text: string }) => (
  <>
    {splitLinks(text).map((part, i) =>
      part.type === "link" ? (
        <a
          key={i}
          href={part.value}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all underline decoration-current/40 underline-offset-2 hover:decoration-current"
        >
          {part.value}
        </a>
      ) : (
        <span key={i}>{part.value}</span>
      ),
    )}
  </>
);

const Ticks = ({ message, seen }: { message: LocalMessage; seen: boolean }) => {
  if (message.status === "sending") return <Clock className="h-3 w-3" aria-label="Sending" />;
  if (message.status === "failed") return <AlertCircle className="h-3 w-3 text-destructive" aria-label="Not sent" />;
  return seen ? (
    <CheckCheck className="h-3.5 w-3.5 text-sky-300" aria-label="Seen" />
  ) : (
    <Check className="h-3.5 w-3.5" aria-label="Sent" />
  );
};

const MessageBubble = ({
  message,
  mine,
  seen,
  groupedWithPrevious,
  groupedWithNext,
  onDelete,
  onRetry,
  onDiscard,
}: {
  message: LocalMessage;
  mine: boolean;
  seen: boolean;
  groupedWithPrevious: boolean;
  groupedWithNext: boolean;
  onDelete: () => void;
  onRetry: () => void;
  onDiscard: () => void;
}) => {
  const time = format(new Date(message.createdAt), "HH:mm");
  const deleted = !!message.deletedAt;
  const pending = !!message.status;

  const copy = () => {
    navigator.clipboard?.writeText(message.body ?? "").then(
      () => toast.success("Copied"),
      () => toast.error("Couldn't copy"),
    );
  };

  const actions = !deleted && !pending && (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Message options"
        className="flex h-7 w-7 shrink-0 items-center justify-center self-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-secondary hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-60"
      >
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={mine ? "end" : "start"} className="w-40">
        <DropdownMenuItem onClick={copy}>
          <Copy className="mr-2 h-3.5 w-3.5" /> Copy text
        </DropdownMenuItem>
        {mine && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (message.isAnnouncement && !deleted) {
    return (
      <div className={cn("group flex items-center gap-1", mine ? "flex-row-reverse" : "flex-row", "mt-4")}>
        <div className="w-full max-w-[85%] overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 to-primary/5 sm:max-w-[70%]">
          <div className="flex items-center gap-1.5 border-b border-primary/20 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
            <Megaphone className="h-3.5 w-3.5" />
            Announcement
            <span className="font-normal normal-case tracking-normal text-muted-foreground">
              · {mine ? "sent to players" : message.senderName}
            </span>
          </div>
          <div className="px-3.5 py-2.5">
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              <MessageText text={message.body ?? ""} />
            </p>
            <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
              {time}
              {mine && <Ticks message={message} seen={seen} />}
            </div>
          </div>
        </div>
        {actions}
      </div>
    );
  }

  return (
    <div className={cn(groupedWithPrevious ? "mt-0.5" : "mt-3")}>
      <div className={cn("group flex items-center gap-1", mine ? "flex-row-reverse" : "flex-row")}>
        <div
          className={cn(
            "relative max-w-[80%] px-3 py-1.5 shadow-sm sm:max-w-[65%]",
            "rounded-2xl",
            mine
              ? cn(
                  "bg-primary text-primary-foreground",
                  groupedWithPrevious && "rounded-tr-md",
                  groupedWithNext && "rounded-br-md",
                )
              : cn(
                  "bg-secondary text-foreground",
                  groupedWithPrevious && "rounded-tl-md",
                  groupedWithNext && "rounded-bl-md",
                ),
            deleted && "border border-dashed border-border bg-transparent text-muted-foreground shadow-none",
            message.status === "sending" && "opacity-80",
            message.status === "failed" && "ring-1 ring-destructive/60",
          )}
        >
          {deleted ? (
            <p className="flex items-center gap-1.5 text-sm italic">
              <Ban className="h-3.5 w-3.5" /> {mine ? "You deleted this message" : "This message was deleted"}
            </p>
          ) : (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              <MessageText text={message.body ?? ""} />
              {/* Reserves room so the time never overlaps the last line of text. */}
              <span className="inline-block w-12" aria-hidden />
            </p>
          )}
          <span
            className={cn(
              "absolute bottom-1 right-2.5 flex items-center gap-0.5 text-[10px] tabular-nums",
              mine && !deleted ? "text-primary-foreground/75" : "text-muted-foreground",
              deleted && "static mt-0.5 justify-end",
            )}
          >
            {time}
            {mine && !deleted && <Ticks message={message} seen={seen} />}
          </span>
        </div>
        {actions}
      </div>
      {message.status === "failed" && (
        <div className="mt-1 flex justify-end gap-3 pr-1 text-[11px]">
          <span className="text-destructive">Not sent</span>
          <button onClick={onRetry} className="font-medium text-primary hover:underline">
            Retry
          </button>
          <button onClick={onDiscard} className="text-muted-foreground hover:text-foreground">
            Discard
          </button>
        </div>
      )}
    </div>
  );
};

const TypingBubble = () => (
  <div className="mt-3 flex">
    <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-secondary px-3.5 py-3" aria-label="Typing">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
          style={{ animationDelay: `${delay}ms`, animationDuration: "1s" }}
        />
      ))}
    </div>
  </div>
);

const ChatThread = ({ conversation, onBack }: { conversation: ConversationDto; onBack: () => void }) => {
  const { currentUser } = useApp();
  const meId = currentUser!.id;
  const { isOnline, isTyping, notifyTyping, setActiveConversation, status } = useChat();
  const queryClient = useQueryClient();
  const key = chatKeys.messages(conversation.id);

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => api.chat.messages(conversation.id, pageParam),
    initialPageParam: undefined as string | undefined,
    // The hub keeps an open thread current; on reconnect the provider refetches.
    staleTime: Infinity,
    getNextPageParam: (oldest) => (oldest.hasMore ? oldest.items[0]?.id : undefined),
  });
  const messages = useMemo(() => flattenMessages(data as MessagePages | undefined), [data]);

  const [text, setText] = useState(() => drafts.get(conversation.id) ?? "");
  const [toDelete, setToDelete] = useState<LocalMessage | null>(null);
  const [newBelow, setNewBelow] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nearBottomRef = useRef(true);
  const restoreFromBottomRef = useRef<number | null>(null);
  const prevFirstIdRef = useRef<string>();
  const prevLastIdRef = useRef<string>();

  const other = conversation.other;
  const online = isOnline(other.id, other.isOnline);
  const typing = isTyping(conversation.id);
  const otherReadAt = conversation.otherLastReadAt ? new Date(conversation.otherLastReadAt).getTime() : 0;

  // ── Active conversation + read receipts ──
  useEffect(() => {
    setActiveConversation(conversation.id);
    return () => setActiveConversation(null);
  }, [conversation.id, setActiveConversation]);

  const markRead = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    api.chat
      .markRead(conversation.id)
      .then((receipt) =>
        queryClient.setQueryData(chatKeys.conversations, (list: ConversationDto[] | undefined) =>
          applyReadReceipt(list, receipt, meId),
        ),
      )
      .catch(() => {});
  }, [conversation.id, meId, queryClient]);

  useEffect(() => {
    if (conversation.unreadCount > 0) markRead();
  }, [conversation.unreadCount, markRead]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && conversation.unreadCount > 0) markRead();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [conversation.unreadCount, markRead]);

  // ── Scrolling ──
  const scrollToBottom = (smooth = true) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    if (nearBottomRef.current && newBelow) setNewBelow(0);
  };

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const first = messages[0]?.id;
    const last = messages[messages.length - 1];

    if (prevLastIdRef.current === undefined && last) {
      // First paint of this thread: start at the newest message.
      el.scrollTop = el.scrollHeight;
    } else if (first !== prevFirstIdRef.current && restoreFromBottomRef.current !== null) {
      // Older messages were prepended: keep what you were reading where it was.
      el.scrollTop = el.scrollHeight - restoreFromBottomRef.current;
      restoreFromBottomRef.current = null;
    } else if (last && last.id !== prevLastIdRef.current) {
      if (nearBottomRef.current || last.senderId === meId) scrollToBottom();
      else setNewBelow((n) => n + 1);
    }
    prevFirstIdRef.current = first;
    prevLastIdRef.current = last?.id;
  }, [messages, meId]);

  useEffect(() => {
    if (typing && nearBottomRef.current) scrollToBottom();
  }, [typing]);

  // Load older history when the top comes into view.
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root || !hasNextPage) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) {
          restoreFromBottomRef.current = root.scrollHeight - root.scrollTop;
          fetchNextPage();
        }
      },
      { root, rootMargin: "200px 0px 0px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ── Composer ──
  useEffect(() => {
    // Desktop only: on phones, focusing would pop the keyboard over the conversation.
    if (window.matchMedia("(hover: hover)").matches) inputRef.current?.focus();
  }, [conversation.id]);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const updateText = (value: string) => {
    setText(value);
    if (value) drafts.set(conversation.id, value);
    else drafts.delete(conversation.id);
    if (value.trim()) notifyTyping(conversation.id);
  };

  const deliver = (body: string, clientId: string) => {
    const optimistic: LocalMessage = {
      id: `pending:${clientId}`,
      conversationId: conversation.id,
      senderId: meId,
      senderName: currentUser!.name,
      body,
      isAnnouncement: false,
      clientId,
      createdAt: new Date().toISOString(),
      deletedAt: null,
      status: "sending",
    };
    queryClient.setQueryData<MessagePages>(key, (d) => upsertMessage(d, optimistic));

    api.chat
      .send(conversation.id, body, clientId)
      .then((sent) => {
        queryClient.setQueryData<MessagePages>(key, (d) => upsertMessage(d, sent));
        // The hub does this too; doing it here keeps the inbox right even while it's reconnecting.
        queryClient.setQueryData(chatKeys.conversations, (list: ConversationDto[] | undefined) => {
          const next = applyMessageToConversations(list, sent, meId, { countAsUnread: false });
          if (next === null) queryClient.invalidateQueries({ queryKey: chatKeys.conversations });
          return next ?? list;
        });
      })
      .catch((err) => {
        queryClient.setQueryData<MessagePages>(key, (d) => upsertMessage(d, { ...optimistic, status: "failed" }));
        toast.error(err instanceof Error ? err.message : "Message not sent.");
      });
  };

  const send = () => {
    const body = text.trim();
    if (!body || isLoading) return;
    deliver(body, newClientId());
    updateText("");
    nearBottomRef.current = true;
    inputRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const discard = (message: LocalMessage) =>
    queryClient.setQueryData<MessagePages>(key, (d) =>
      d && { ...d, pages: d.pages.map((p) => ({ ...p, items: p.items.filter((m) => m.id !== message.id) })) },
    );

  const confirmDelete = () => {
    const message = toDelete;
    setToDelete(null);
    if (!message) return;
    api.chat
      .remove(message.id)
      .then((deleted) => queryClient.setQueryData<MessagePages>(key, (d) => upsertMessage(d, deleted)))
      .catch((err) => toast.error(err instanceof Error ? err.message : "Couldn't delete the message."));
  };

  const remaining = MAX_MESSAGE_LENGTH - text.length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-3 py-2.5 sm:px-4">
        <button
          onClick={onBack}
          aria-label="Back to chats"
          className="-ml-1 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <ChatAvatar id={other.id} name={other.name} online={online} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-semibold">{other.name}</h2>
            {other.isAdmin && <AdminBadge />}
          </div>
          <p className="truncate text-xs">
            {typing ? (
              <span className="font-medium text-primary">typing…</span>
            ) : online ? (
              <span className="text-success">Online</span>
            ) : (
              <span className="text-muted-foreground">{other.whatsAppName ?? "Offline"}</span>
            )}
          </p>
        </div>
        {status === "reconnecting" && (
          <span className="flex items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-1 text-[11px] font-medium text-warning">
            <WifiOff className="h-3 w-3" /> Reconnecting…
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="h-full overflow-y-auto overscroll-contain px-3 pb-4 sm:px-5"
          role="log"
          aria-live="polite"
          aria-label={`Conversation with ${other.name}`}
        >
          <div ref={topSentinelRef} />
          {isFetchingNextPage && (
            <div className="flex justify-center py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {!hasNextPage && !isLoading && messages.length > 0 && (
            <p className="py-4 text-center text-[11px] text-muted-foreground">
              This is the start of your chat with {other.name}.
            </p>
          )}

          {isLoading ? (
            <div className="space-y-3 pt-6">
              {[48, 64, 36, 56, 44].map((w, i) => (
                <div key={i} className={cn("flex", i % 2 ? "justify-end" : "justify-start")}>
                  <Skeleton className="h-9 rounded-2xl" style={{ width: `${w}%` }} />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center pt-16 text-center">
              <p className="text-sm text-muted-foreground">Couldn't load this conversation.</p>
              <button onClick={() => refetch()} className="mt-2 text-sm font-medium text-primary hover:underline">
                Try again
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <ChatAvatar id={other.id} name={other.name} size="lg" online={online} />
              <p className="mt-3 text-sm font-medium">Say hello to {other.name} 👋</p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                {other.isAdmin
                  ? "Questions about the game, your account or a result? Ask here."
                  : "Talk tactics, trade predictions, or just banter about the weekend."}
              </p>
            </div>
          ) : (
            messages.map((m, i) => {
              const previous = messages[i - 1];
              const next = messages[i + 1];
              const mine = m.senderId === meId;
              return (
                <div key={m.clientId && mine ? `c:${m.clientId}` : m.id}>
                  {startsNewDay(previous, m) && (
                    <div className="sticky top-0 z-10 flex justify-center py-2">
                      <span className="rounded-full border border-border bg-card/90 px-3 py-0.5 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur">
                        {dayLabel(m.createdAt)}
                      </span>
                    </div>
                  )}
                  <MessageBubble
                    message={m}
                    mine={mine}
                    seen={mine && !m.status && new Date(m.createdAt).getTime() <= otherReadAt}
                    groupedWithPrevious={continuesGroup(previous, m) && !startsNewDay(previous, m)}
                    groupedWithNext={!!next && continuesGroup(m, next)}
                    onDelete={() => setToDelete(m)}
                    onRetry={() => m.body && m.clientId && deliver(m.body, m.clientId)}
                    onDiscard={() => discard(m)}
                  />
                </div>
              );
            })
          )}
          {typing && <TypingBubble />}
        </div>

        {newBelow > 0 && (
          <button
            onClick={() => {
              setNewBelow(0);
              scrollToBottom();
            }}
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-lg fade-in-up"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            {newBelow === 1 ? "1 new message" : `${newBelow} new messages`}
          </button>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-4">
        <div className="flex items-end gap-2">
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => updateText(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              maxLength={MAX_MESSAGE_LENGTH}
              placeholder={`Message ${other.name.split(" ")[0]}…`}
              aria-label="Message"
              className="block max-h-40 min-h-[42px] w-full resize-none rounded-2xl border border-border bg-background px-4 py-2.5 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60"
            />
            {remaining <= 200 && (
              <span
                className={cn(
                  "pointer-events-none absolute -top-5 right-2 text-[10px] tabular-nums",
                  remaining <= 20 ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {remaining}
              </span>
            )}
          </div>
          <button
            onClick={send}
            disabled={!text.trim() || isLoading}
            aria-label="Send"
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-all hover:brightness-110 active:scale-95 disabled:scale-100 disabled:opacity-40"
          >
            <SendHorizontal className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 hidden text-[10px] text-muted-foreground sm:block">
          <kbd className="font-sans">Enter</kbd> to send · <kbd className="font-sans">Shift + Enter</kbd> for a new line
        </p>
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this message?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be removed for {other.name} too. They'll see that a message was deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ChatThread;
