import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessagesSquare } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import { api, type ChatUserDto, type ConversationDto } from "@/lib/api";
import { chatKeys } from "@/lib/chat";
import { usePermissions } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import ConversationList from "./ConversationList";
import ChatThread from "./ChatThread";
import NewChatDialog from "./NewChatDialog";
import BroadcastDialog from "./BroadcastDialog";

/**
 * The whole messaging screen: inbox and open conversation side by side on wide screens, one at
 * a time on phones. The open conversation lives in the URL (`basePath/:conversationId`), so it
 * survives a reload and can be linked to.
 */
const ChatWorkspace = ({ basePath }: { basePath: string }) => {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentUser } = useApp();
  const { can } = usePermissions();
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: chatKeys.conversations,
    queryFn: api.chat.conversations,
    staleTime: 60_000,
  });

  const fromList = conversations.find((c) => c.id === conversationId);
  // A new chat with no messages yet isn't in the inbox, so look it up by itself.
  const { data: single, isError: notFound } = useQuery({
    queryKey: ["chat", "conversation", conversationId],
    queryFn: () => api.chat.conversation(conversationId!),
    enabled: !!conversationId && !isLoading && !fromList,
    retry: false,
  });
  const active = fromList ?? (single?.id === conversationId ? single : undefined);

  const open = (id: string) => navigate(`${basePath}/${id}`);

  const { mutate: start, variables: pendingUser, isPending } = useMutation({
    mutationFn: (user: ChatUserDto) => api.chat.start(user.id),
    onSuccess: (conversation: ConversationDto) => {
      queryClient.setQueryData(["chat", "conversation", conversation.id], conversation);
      setNewChatOpen(false);
      open(conversation.id);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't open that chat."),
  });

  const isAdmin = currentUser?.role === "admin";

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-card md:m-4 md:rounded-2xl md:border md:border-border md:shadow-xl md:shadow-black/20">
      <aside
        className={cn(
          "min-h-0 w-full shrink-0 flex-col border-border md:flex md:w-80 md:border-r lg:w-[22rem]",
          conversationId ? "hidden" : "flex",
        )}
      >
        <ConversationList
          conversations={conversations}
          isLoading={isLoading}
          activeId={conversationId ?? null}
          meId={currentUser!.id}
          onSelect={open}
          onNewChat={() => setNewChatOpen(true)}
          onAnnounce={isAdmin && can("messages.broadcast") ? () => setBroadcastOpen(true) : undefined}
        />
      </aside>

      <section className={cn("min-h-0 min-w-0 flex-1 flex-col md:flex", conversationId ? "flex" : "hidden")}>
        {active ? (
          <ChatThread key={active.id} conversation={active} onBack={() => navigate(basePath)} />
        ) : conversationId && !notFound ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-secondary">
                <MessagesSquare className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h2 className="mt-5 text-base font-semibold">
              {notFound ? "That chat isn't available" : "Pick a chat"}
            </h2>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              {notFound
                ? "It may have been removed, or it isn't one of yours."
                : "Choose a conversation on the left, or start a new one."}
            </p>
            <button
              onClick={() => setNewChatOpen(true)}
              className="mt-4 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02] active:scale-95"
            >
              New chat
            </button>
          </div>
        )}
      </section>

      <NewChatDialog
        open={newChatOpen}
        onOpenChange={setNewChatOpen}
        onPick={(user) => start(user)}
        pendingUserId={isPending ? pendingUser?.id ?? null : null}
      />
      {isAdmin && <BroadcastDialog open={broadcastOpen} onOpenChange={setBroadcastOpen} />}
    </div>
  );
};

export default ChatWorkspace;
