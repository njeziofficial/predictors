import { describe, expect, it } from "vitest";
import type { ChatMessageDto, ConversationDto } from "@/lib/api";
import {
  applyMessageToConversations,
  applyReadReceipt,
  continuesGroup,
  dayLabel,
  flattenMessages,
  formatListTime,
  initials,
  splitLinks,
  totalUnread,
  upsertMessage,
  type MessagePages,
} from "@/lib/chat";

const ME = "me";
const THEM = "them";

const msg = (over: Partial<ChatMessageDto> = {}): ChatMessageDto => ({
  id: "m1",
  conversationId: "c1",
  senderId: THEM,
  senderName: "Them",
  body: "hi",
  isAnnouncement: false,
  clientId: null,
  createdAt: "2026-10-08T10:00:00.000Z",
  deletedAt: null,
  ...over,
});

const conv = (over: Partial<ConversationDto> = {}): ConversationDto => ({
  id: "c1",
  other: { id: THEM, name: "Them", whatsAppName: null, isAdmin: false, isOnline: false },
  lastMessage: null,
  unreadCount: 0,
  myLastReadAt: null,
  otherLastReadAt: null,
  lastMessageAt: "2026-10-08T09:00:00.000Z",
  ...over,
});

const pages = (...pageItems: ChatMessageDto[][]): MessagePages => ({
  pages: pageItems.map((items) => ({ items, hasMore: false })),
  pageParams: pageItems.map(() => undefined),
});

describe("upsertMessage", () => {
  it("appends a new message to the newest page", () => {
    const data = pages([msg({ id: "a" })], [msg({ id: "old" })]);
    const next = upsertMessage(data, msg({ id: "b" }))!;
    expect(next.pages[0].items.map((m) => m.id)).toEqual(["a", "b"]);
    expect(next.pages[1].items.map((m) => m.id)).toEqual(["old"]);
  });

  it("replaces our optimistic copy with the server's by clientId", () => {
    const pending = { ...msg({ id: "pending:x", senderId: ME, clientId: "x" }), status: "sending" as const };
    const next = upsertMessage(pages([pending]), msg({ id: "real", senderId: ME, clientId: "x" }))!;
    expect(next.pages[0].items).toHaveLength(1);
    expect(next.pages[0].items[0].id).toBe("real");
    expect(next.pages[0].items[0].status).toBeUndefined();
  });

  it("doesn't let a late copy undo a deletion", () => {
    const deleted = msg({ id: "a", body: null, deletedAt: "2026-10-08T10:01:00.000Z" });
    const next = upsertMessage(pages([deleted]), msg({ id: "a" }))!;
    expect(next.pages[0].items[0].deletedAt).not.toBeNull();
  });

  it("leaves an unloaded thread alone", () => {
    expect(upsertMessage(undefined, msg())).toBeUndefined();
  });
});

describe("flattenMessages", () => {
  it("returns oldest first across pages", () => {
    const data = pages([msg({ id: "c" }), msg({ id: "d" })], [msg({ id: "a" }), msg({ id: "b" })]);
    expect(flattenMessages(data).map((m) => m.id)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("applyMessageToConversations", () => {
  it("counts an incoming message as unread and moves the chat to the top", () => {
    const list = [conv({ id: "c0", lastMessageAt: "2026-10-08T09:30:00.000Z" }), conv()];
    const next = applyMessageToConversations(list, msg(), ME, { countAsUnread: true })!;
    expect(next[0].id).toBe("c1");
    expect(next[0].unreadCount).toBe(1);
    expect(next[0].lastMessage?.id).toBe("m1");
  });

  it("doesn't count the same message twice", () => {
    const list = [conv({ lastMessage: msg(), unreadCount: 1 })];
    const next = applyMessageToConversations(list, msg(), ME, { countAsUnread: true })!;
    expect(next[0].unreadCount).toBe(1);
  });

  it("clears unread when I send", () => {
    const list = [conv({ unreadCount: 3 })];
    const next = applyMessageToConversations(list, msg({ senderId: ME }), ME, { countAsUnread: false })!;
    expect(next[0].unreadCount).toBe(0);
  });

  it("signals an unknown conversation with null", () => {
    expect(applyMessageToConversations([conv()], msg({ conversationId: "new" }), ME, { countAsUnread: true })).toBeNull();
  });
});

describe("applyReadReceipt", () => {
  it("clears my unread when I read", () => {
    const next = applyReadReceipt([conv({ unreadCount: 2 })], { conversationId: "c1", userId: ME, readAt: "t" }, ME)!;
    expect(next[0].unreadCount).toBe(0);
  });

  it("records when the other person read", () => {
    const next = applyReadReceipt([conv()], { conversationId: "c1", userId: THEM, readAt: "t" }, ME)!;
    expect(next[0].otherLastReadAt).toBe("t");
  });
});

describe("formatting", () => {
  const now = new Date(2026, 9, 8, 15, 0);

  it("formats inbox times relative to now", () => {
    expect(formatListTime(new Date(2026, 9, 8, 9, 5).toISOString(), now)).toBe("09:05");
    expect(formatListTime(new Date(2026, 9, 7, 9, 5).toISOString(), now)).toBe("Yesterday");
    expect(formatListTime(new Date(2026, 8, 1).toISOString(), now)).toBe("01/09/26");
  });

  it("labels days", () => {
    expect(dayLabel(new Date(2026, 9, 8, 1).toISOString(), now)).toBe("Today");
    expect(dayLabel(new Date(2026, 9, 7, 1).toISOString(), now)).toBe("Yesterday");
    expect(dayLabel(new Date(2025, 0, 2).toISOString(), now)).toBe("2 Jan 2025");
  });

  it("groups quick consecutive messages from the same sender", () => {
    const a = msg({ createdAt: "2026-10-08T10:00:00.000Z" });
    expect(continuesGroup(a, msg({ id: "b", createdAt: "2026-10-08T10:02:00.000Z" }))).toBe(true);
    expect(continuesGroup(a, msg({ id: "b", createdAt: "2026-10-08T10:09:00.000Z" }))).toBe(false);
    expect(continuesGroup(a, msg({ id: "b", senderId: ME }))).toBe(false);
    expect(continuesGroup(a, msg({ id: "b", isAnnouncement: true }))).toBe(false);
  });

  it("splits out links without swallowing trailing punctuation", () => {
    expect(splitLinks("see https://example.com/a?b=1. ok")).toEqual([
      { type: "text", value: "see " },
      { type: "link", value: "https://example.com/a?b=1" },
      { type: "text", value: ". ok" },
    ]);
    expect(splitLinks("no links")).toEqual([{ type: "text", value: "no links" }]);
  });

  it("makes initials", () => {
    expect(initials("Ada Lovelace King")).toBe("AL");
    expect(initials("  ")).toBe("?");
  });

  it("totals unread", () => {
    expect(totalUnread([conv({ unreadCount: 2 }), conv({ id: "c2", unreadCount: 3 })])).toBe(5);
    expect(totalUnread(undefined)).toBe(0);
  });
});
