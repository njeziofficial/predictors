import type { InfiniteData } from "@tanstack/react-query";
import { differenceInCalendarDays, format, isSameDay } from "date-fns";
import type { ChatMessageDto, ConversationDto, MessagePageDto, ReadReceiptDto } from "./api";

/**
 * Pure helpers behind the chat: React Query cache updates for hub events, and the formatting
 * the message list uses. Kept free of React and SignalR so they can be tested on their own.
 */

export const MAX_MESSAGE_LENGTH = 2000;

export const chatKeys = {
  all: ["chat"] as const,
  conversations: ["chat", "conversations"] as const,
  messages: (conversationId: string) => ["chat", "messages", conversationId] as const,
  directory: ["chat", "directory"] as const,
};

// A message as the thread holds it: the server's copy, or one of ours still on its way.
export type LocalMessage = ChatMessageDto & { status?: "sending" | "failed" };

// pages[0] is the newest page; each later page is older. Items within a page are oldest first.
export type MessagePages = InfiniteData<MessagePageDto & { items: LocalMessage[] }, string | undefined>;

// Our optimistic copy and the server's share a clientId; the server's copy has the real id.
const sameMessage = (a: LocalMessage, b: LocalMessage) =>
  a.id === b.id || (!!b.clientId && a.clientId === b.clientId && a.senderId === b.senderId);

/** Replaces the matching message wherever it is, or appends it as the newest. */
export function upsertMessage(data: MessagePages | undefined, message: LocalMessage): MessagePages | undefined {
  if (!data || data.pages.length === 0) return data;
  let found = false;
  const pages = data.pages.map((page) => {
    const index = page.items.findIndex((m) => sameMessage(m, message));
    if (index === -1) return page;
    found = true;
    const items = page.items.slice();
    // A late HTTP response must not undo a deletion the hub already delivered.
    items[index] = items[index].deletedAt && !message.deletedAt ? items[index] : message;
    return { ...page, items };
  });
  if (found) return { ...data, pages };
  const [newest, ...older] = pages;
  return { ...data, pages: [{ ...newest, items: [...newest.items, message] }, ...older] };
}

/** All loaded messages, oldest first. */
export const flattenMessages = (data: MessagePages | undefined): LocalMessage[] =>
  data ? [...data.pages].reverse().flatMap((p) => p.items) : [];

const byRecent = (a: ConversationDto, b: ConversationDto) => b.lastMessageAt.localeCompare(a.lastMessageAt);

/**
 * Applies a new message to the inbox. Returns null when the conversation isn't in the list yet
 * (a brand-new chat), so the caller knows to refetch.
 */
export function applyMessageToConversations(
  list: ConversationDto[] | undefined,
  message: ChatMessageDto,
  meId: string,
  { countAsUnread }: { countAsUnread: boolean },
): ConversationDto[] | null | undefined {
  if (!list) return list;
  const index = list.findIndex((c) => c.id === message.conversationId);
  if (index === -1) return null;

  const current = list[index];
  const mine = message.senderId === meId;
  const alreadySeen = current.lastMessage?.id === message.id;
  const isNewer = !current.lastMessage || message.createdAt >= current.lastMessage.createdAt;

  const updated: ConversationDto = {
    ...current,
    lastMessage: isNewer || alreadySeen ? message : current.lastMessage,
    lastMessageAt: isNewer ? message.createdAt : current.lastMessageAt,
    // Sending a message marks the conversation read on the server too.
    unreadCount: mine ? 0 : current.unreadCount + (countAsUnread && !alreadySeen ? 1 : 0),
    myLastReadAt: mine ? message.createdAt : current.myLastReadAt,
  };
  const next = list.slice();
  next[index] = updated;
  return next.sort(byRecent);
}

export function applyReadReceipt(
  list: ConversationDto[] | undefined,
  receipt: ReadReceiptDto,
  meId: string,
): ConversationDto[] | undefined {
  if (!list) return list;
  return list.map((c) => {
    if (c.id !== receipt.conversationId) return c;
    return receipt.userId === meId
      ? { ...c, unreadCount: 0, myLastReadAt: receipt.readAt }
      : { ...c, otherLastReadAt: receipt.readAt };
  });
}

export function applyDeletedToConversations(
  list: ConversationDto[] | undefined,
  message: ChatMessageDto,
): ConversationDto[] | undefined {
  if (!list) return list;
  return list.map((c) => (c.lastMessage?.id === message.id ? { ...c, lastMessage: message } : c));
}

export function applyPresence(
  list: ConversationDto[] | undefined,
  userId: string,
  online: boolean,
): ConversationDto[] | undefined {
  if (!list) return list;
  return list.map((c) => (c.other.id === userId ? { ...c, other: { ...c.other, isOnline: online } } : c));
}

export const totalUnread = (list: ConversationDto[] | undefined) =>
  (list ?? []).reduce((sum, c) => sum + c.unreadCount, 0);

// ── Formatting ────────────────────────────────────────────────────────────────

/** Inbox timestamp: time today, "Yesterday", weekday this week, otherwise a short date. */
export function formatListTime(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const days = differenceInCalendarDays(now, date);
  if (days <= 0) return format(date, "HH:mm");
  if (days === 1) return "Yesterday";
  if (days < 7) return format(date, "EEE");
  return format(date, "dd/MM/yy");
}

/** Separator between days in a thread. */
export function dayLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const days = differenceInCalendarDays(now, date);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return format(date, "EEEE");
  return format(date, date.getFullYear() === now.getFullYear() ? "EEE d MMM" : "d MMM yyyy");
}

const GROUP_WINDOW_MS = 5 * 60 * 1000;

/** Whether `current` continues `previous`'s bubble group (same sender, same day, close in time). */
export function continuesGroup(previous: LocalMessage | undefined, current: LocalMessage): boolean {
  if (!previous) return false;
  if (previous.senderId !== current.senderId) return false;
  if (previous.isAnnouncement || current.isAnnouncement) return false;
  const a = new Date(previous.createdAt);
  const b = new Date(current.createdAt);
  return isSameDay(a, b) && b.getTime() - a.getTime() < GROUP_WINDOW_MS;
}

export const startsNewDay = (previous: LocalMessage | undefined, current: LocalMessage) =>
  !previous || !isSameDay(new Date(previous.createdAt), new Date(current.createdAt));

export type TextPart = { type: "text" | "link"; value: string };

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/gi;

/** Splits message text so links can be rendered as anchors (still as React text, never HTML). */
export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    if (start > last) parts.push({ type: "text", value: text.slice(last, start) });
    parts.push({ type: "link", value: match[0] });
    last = start + match[0].length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
}

export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";

// Stable per person, so someone keeps the same avatar colour everywhere.
const AVATAR_HUES = [12, 32, 160, 190, 210, 250, 280, 330];
export function avatarHue(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_HUES[Math.abs(hash) % AVATAR_HUES.length];
}

export const newClientId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
