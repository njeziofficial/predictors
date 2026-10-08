import { useMemo, useState } from "react";
import { Ban, Megaphone, MessageCirclePlus, Search, SquarePen } from "lucide-react";
import type { ConversationDto } from "@/lib/api";
import { formatListTime } from "@/lib/chat";
import { useChat } from "@/context/ChatContext";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import ChatAvatar, { AdminBadge } from "./ChatAvatar";

const Preview = ({ conversation, meId }: { conversation: ConversationDto; meId: string }) => {
  const { isTyping } = useChat();
  const last = conversation.lastMessage;

  if (isTyping(conversation.id)) return <span className="font-medium text-primary">typing…</span>;
  if (!last) return <span className="italic">No messages yet</span>;
  if (last.deletedAt)
    return (
      <span className="inline-flex items-center gap-1 italic">
        <Ban className="h-3 w-3" /> Message deleted
      </span>
    );
  return (
    <>
      {last.isAnnouncement && <Megaphone className="mr-1 inline h-3 w-3 -translate-y-px text-primary" />}
      {last.senderId === meId && <span className="text-muted-foreground/80">You: </span>}
      {last.body}
    </>
  );
};

const ConversationList = ({
  conversations,
  isLoading,
  activeId,
  meId,
  onSelect,
  onNewChat,
  onAnnounce,
}: {
  conversations: ConversationDto[];
  isLoading: boolean;
  activeId: string | null;
  meId: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  // Shown only to admins allowed to send announcements.
  onAnnounce?: () => void;
}) => {
  const { isOnline, unreadTotal } = useChat();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) => c.other.name.toLowerCase().includes(q) || c.other.whatsAppName?.toLowerCase().includes(q),
    );
  }, [conversations, search]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-3 border-b border-border px-4 pb-3 pt-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold leading-tight">Messages</h1>
            <p className="text-xs text-muted-foreground">
              {unreadTotal > 0 ? `${unreadTotal} unread` : "You're all caught up"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {onAnnounce && (
              <button
                onClick={onAnnounce}
                title="New announcement"
                className="flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                <Megaphone className="h-3.5 w-3.5 text-primary" />
                <span className="hidden sm:inline">Announce</span>
              </button>
            )}
            <button
              onClick={onNewChat}
              title="New chat"
              aria-label="New chat"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform hover:scale-105 active:scale-95"
            >
              <SquarePen className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats"
            className="h-9 w-full rounded-full border border-border bg-background pl-8 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {isLoading ? (
          <div className="space-y-1 px-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center px-6 pt-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
              <MessageCirclePlus className="h-6 w-6 text-primary" />
            </div>
            <p className="mt-3 text-sm font-medium">No chats yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Message another player, or an admin if you need a hand.</p>
            <button onClick={onNewChat} className="mt-4 text-sm font-medium text-primary hover:underline">
              Start a chat
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-4 pt-10 text-center text-sm text-muted-foreground">No chats match “{search.trim()}”.</p>
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((c) => {
              const unread = c.unreadCount > 0;
              const active = c.id === activeId;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => onSelect(c.id)}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors",
                      active ? "bg-secondary" : "hover:bg-secondary/60",
                    )}
                  >
                    <ChatAvatar id={c.other.id} name={c.other.name} online={isOnline(c.other.id, c.other.isOnline)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn("truncate text-sm", unread ? "font-semibold" : "font-medium")}>
                          {c.other.name}
                        </span>
                        {c.other.isAdmin && <AdminBadge />}
                        <span
                          className={cn(
                            "ml-auto shrink-0 text-[11px] tabular-nums",
                            unread ? "font-medium text-primary" : "text-muted-foreground",
                          )}
                        >
                          {c.lastMessage && formatListTime(c.lastMessage.createdAt)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <p
                          className={cn(
                            "min-w-0 flex-1 truncate text-xs",
                            unread ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          <Preview conversation={c} meId={meId} />
                        </p>
                        {unread && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                            {c.unreadCount > 99 ? "99+" : c.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ConversationList;
