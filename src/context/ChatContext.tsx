import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection } from "@microsoft/signalr";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import { api, CHAT_HUB_URL, getFreshToken, type ChatMessageDto, type ConversationDto, type ReadReceiptDto } from "@/lib/api";
import {
  applyDeletedToConversations,
  applyMessageToConversations,
  applyPresence,
  applyReadReceipt,
  chatKeys,
  totalUnread,
  upsertMessage,
  type MessagePages,
} from "@/lib/chat";
import { ALL_LIVE_AREAS, invalidateLiveAreas } from "@/lib/liveData";

export type ChatConnectionStatus = "offline" | "connecting" | "connected" | "reconnecting";

interface ChatState {
  status: ChatConnectionStatus;
  unreadTotal: number;
  /** Live online state, falling back to what the server said when the data was loaded. */
  isOnline: (userId: string, fallback?: boolean) => boolean;
  isTyping: (conversationId: string) => boolean;
  /** Tell the other person we're typing (throttled here, so call it on every keystroke). */
  notifyTyping: (conversationId: string) => void;
  /** The conversation open on screen: its messages count as read and don't pop a toast. */
  setActiveConversation: (conversationId: string | null) => void;
}

const ChatContext = createContext<ChatState | undefined>(undefined);

const TYPING_SHOWN_MS = 4000;
const TYPING_THROTTLE_MS = 2500;
// Reconnect quickly at first, then keep trying every 30s for as long as the tab is open.
const RETRY_DELAYS = [0, 2000, 5000, 10000];

const chatPath = (pathname: string) => (pathname.startsWith("/admin") ? "/admin/messages" : "/messages");

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const { currentUser } = useApp();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  const meId = currentUser?.id ?? null;
  // A user forced to reset their password can't use the app yet, so no chat either.
  const enabled = !!meId && !currentUser?.mustResetPassword;

  const [status, setStatus] = useState<ChatConnectionStatus>("offline");
  const [presence, setPresence] = useState<Record<string, boolean>>({});
  const [typing, setTyping] = useState<Record<string, number>>({});

  const connectionRef = useRef<HubConnection | null>(null);
  const activeRef = useRef<string | null>(null);
  const lastTypingSentRef = useRef<Record<string, number>>({});
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

  const { data: conversations } = useQuery({
    queryKey: chatKeys.conversations,
    queryFn: api.chat.conversations,
    enabled,
    staleTime: 60_000,
  });

  // The query cache itself is cleared by AppProvider on account change; this is live-only state.
  useEffect(() => {
    return () => {
      setPresence({});
      setTyping({});
    };
  }, [meId]);

  useEffect(() => {
    if (!enabled || !meId) return;

    const connection = new HubConnectionBuilder()
      .withUrl(CHAT_HUB_URL, {
        accessTokenFactory: getFreshToken,
        // Auth is the bearer token, not cookies, so the hub needs no credentialed CORS.
        withCredentials: false,
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (ctx) => RETRY_DELAYS[ctx.previousRetryCount] ?? 30_000,
      })
      .configureLogging(LogLevel.Warning)
      .build();
    connectionRef.current = connection;

    const onMessage = (message: ChatMessageDto) => {
      const mine = message.senderId === meId;
      const viewing = activeRef.current === message.conversationId && document.visibilityState === "visible";

      queryClient.setQueryData<MessagePages>(chatKeys.messages(message.conversationId), (d) => upsertMessage(d, message));

      let known = true;
      queryClient.setQueryData(chatKeys.conversations, (list: ConversationDto[] | undefined) => {
        const next = applyMessageToConversations(list, message, meId, { countAsUnread: !mine && !viewing });
        if (next === null) {
          known = false;
          return list;
        }
        return next;
      });
      if (!known) queryClient.invalidateQueries({ queryKey: chatKeys.conversations });

      // They stopped typing the moment the message landed.
      setTyping((t) => {
        if (!(message.conversationId in t)) return t;
        const { [message.conversationId]: _, ...rest } = t;
        return rest;
      });

      if (mine) return;
      if (viewing) {
        api.chat.markRead(message.conversationId).catch(() => {});
        return;
      }
      // On the messages screen the inbox already shows it; elsewhere, pop a toast.
      if (!/\/messages(\/|$)/.test(pathRef.current)) {
        const preview = message.body ?? "";
        toast(message.isAnnouncement ? `📣 ${message.senderName}` : message.senderName, {
          id: `chat-${message.conversationId}`,
          description: preview.length > 90 ? `${preview.slice(0, 90)}…` : preview,
          action: {
            label: "Open",
            onClick: () => navigate(`${chatPath(pathRef.current)}/${message.conversationId}`),
          },
        });
      }
    };

    const onDeleted = (message: ChatMessageDto) => {
      queryClient.setQueryData<MessagePages>(chatKeys.messages(message.conversationId), (d) => upsertMessage(d, message));
      queryClient.setQueryData(chatKeys.conversations, (list: ConversationDto[] | undefined) =>
        applyDeletedToConversations(list, message),
      );
      // An unread message may have just vanished; let the server recount.
      if (message.senderId !== meId) queryClient.invalidateQueries({ queryKey: chatKeys.conversations });
    };

    const onRead = (receipt: ReadReceiptDto) => {
      queryClient.setQueryData(chatKeys.conversations, (list: ConversationDto[] | undefined) =>
        applyReadReceipt(list, receipt, meId),
      );
    };

    const onTyping = (conversationId: string, userId: string) => {
      if (userId === meId) return;
      setTyping((t) => ({ ...t, [conversationId]: Date.now() + TYPING_SHOWN_MS }));
    };

    const onPresence = (userId: string, online: boolean) => {
      setPresence((p) => ({ ...p, [userId]: online }));
      queryClient.setQueryData(chatKeys.conversations, (list: ConversationDto[] | undefined) =>
        applyPresence(list, userId, online),
      );
    };

    connection.on("MessageReceived", onMessage);
    connection.on("MessageDeleted", onDeleted);
    connection.on("ConversationRead", onRead);
    connection.on("Typing", onTyping);
    connection.on("PresenceChanged", onPresence);
    // Fixtures, standings or settings changed on the server: refresh just those.
    connection.on("DataChanged", (areas: string[]) => {
      invalidateLiveAreas(queryClient, areas);
    });

    connection.onreconnecting(() => setStatus("reconnecting"));
    connection.onreconnected(() => {
      setStatus("connected");
      // Whatever happened while we were away: fetch it rather than guess.
      setPresence({});
      queryClient.invalidateQueries({ queryKey: chatKeys.all });
      // Any DataChanged pushes sent while we were away were missed.
      invalidateLiveAreas(queryClient, ALL_LIVE_AREAS);
    });
    connection.onclose(() => setStatus("offline"));

    let cancelled = false;
    const start = async (attempt = 0) => {
      if (cancelled) return;
      setStatus("connecting");
      try {
        await connection.start();
        if (!cancelled) setStatus("connected");
      } catch {
        // withAutomaticReconnect only covers drops after a successful start.
        if (!cancelled) {
          setStatus("reconnecting");
          setTimeout(() => start(attempt + 1), RETRY_DELAYS[attempt + 1] ?? 30_000);
        }
      }
    };
    start();

    return () => {
      cancelled = true;
      connectionRef.current = null;
      connection.stop().catch(() => {});
      setStatus("offline");
    };
  }, [enabled, meId, queryClient, navigate]);

  // Expire typing indicators.
  useEffect(() => {
    const ids = Object.keys(typing);
    if (ids.length === 0) return;
    const nextExpiry = Math.min(...Object.values(typing));
    const timer = setTimeout(() => {
      const now = Date.now();
      setTyping((t) => Object.fromEntries(Object.entries(t).filter(([, until]) => until > now)));
    }, Math.max(0, nextExpiry - Date.now()) + 50);
    return () => clearTimeout(timer);
  }, [typing]);

  const unreadTotal = totalUnread(conversations);

  // "(3) Octopus Prediction" in the tab title, so new messages show from another tab.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\+?\)\s*/, "");
    document.title = unreadTotal > 0 ? `(${unreadTotal > 99 ? "99+" : unreadTotal}) ${base}` : base;
  }, [unreadTotal]);

  const notifyTyping = useCallback((conversationId: string) => {
    const connection = connectionRef.current;
    if (connection?.state !== HubConnectionState.Connected) return;
    const now = Date.now();
    if (now - (lastTypingSentRef.current[conversationId] ?? 0) < TYPING_THROTTLE_MS) return;
    lastTypingSentRef.current[conversationId] = now;
    connection.invoke("Typing", conversationId).catch(() => {});
  }, []);

  const setActiveConversation = useCallback((conversationId: string | null) => {
    activeRef.current = conversationId;
  }, []);

  const isOnline = useCallback(
    (userId: string, fallback = false) => presence[userId] ?? fallback,
    [presence],
  );
  const isTyping = useCallback((conversationId: string) => (typing[conversationId] ?? 0) > Date.now(), [typing]);

  const value = useMemo(
    () => ({ status, unreadTotal, isOnline, isTyping, notifyTyping, setActiveConversation }),
    [status, unreadTotal, isOnline, isTyping, notifyTyping, setActiveConversation],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be inside ChatProvider");
  return ctx;
};
