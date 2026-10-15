import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { badgeText, sentSummary } from "@/lib/notificationCount";
import type { InboxDto } from "@/lib/api";

const inbox: InboxDto = {
  unread: 2,
  total: 2,
  page: 1,
  pageSize: 10,
  items: [
    { id: "a", kind: "reminder", title: "Week 9 predictions", body: "La Liga kicks off in 3 hours.", url: "/predict", createdAt: new Date().toISOString(), read: false },
    { id: "b", kind: "announcement", title: "Fixture change", body: "Moved to Sunday, and the full reason is right here.", url: "/", createdAt: new Date().toISOString(), read: false },
  ],
};

// Stands in for the server: remembers what was read and deleted, as the real one does.
let server: InboxDto = structuredClone(inbox);
const recount = () => {
  server.unread = server.items.filter((i) => !i.read).length;
  server.total = server.items.length;
};
const markRead = vi.fn(async (id: string) => {
  server.items = server.items.map((i) => (i.id === id ? { ...i, read: true } : i));
  recount();
});
const markAllRead = vi.fn(async () => {
  server.items = server.items.map((i) => ({ ...i, read: true }));
  recount();
});
const remove = vi.fn(async (id: string) => {
  server.items = server.items.filter((i) => i.id !== id);
  recount();
});
vi.mock("@/lib/api", () => ({
  api: {
    notifications: {
      list: vi.fn(() => Promise.resolve(structuredClone(server))),
      markRead: (id: string) => markRead(id),
      markAllRead: () => markAllRead(),
      remove: (id: string) => remove(id),
      removeMany: vi.fn(),
      removeRead: vi.fn(),
    },
  },
}));
vi.mock("@/context/AppContext", () => ({ useApp: () => ({ currentUser: { id: "user-1", name: "Pat" } }) }));
vi.mock("@/lib/push", () => ({ clearShownNotifications: vi.fn(() => Promise.resolve()) }));

const renderBell = async () => {
  const { default: NotificationBell } = await import("@/components/NotificationBell");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("badge count", () => {
  it("caps at 9+", () => {
    expect(badgeText(0)).toBeNull();
    expect(badgeText(1)).toBe("1");
    expect(badgeText(9)).toBe("9");
    expect(badgeText(10)).toBe("9+");
    expect(badgeText(250)).toBe("9+");
  });
});

describe("what an admin's send says", () => {
  it("says it went to the app even when no phone has notifications on", () => {
    const text = sentSummary({ targeted: 0, reached: 0, inApp: 1 });
    expect(text).toContain("Sent to 1 player in the app.");
    expect(text).toContain("Nobody in it has phone notifications on");
    expect(text).not.toContain("0 of 0");
  });

  it("counts phones and email separately", () => {
    expect(sentSummary({ targeted: 3, reached: 3, inApp: 5 })).toBe(
      "Sent to 5 players in the app. All 3 with phone notifications on got it there too.",
    );
    expect(sentSummary({ targeted: 3, reached: 2, inApp: 5, emailed: 1 })).toBe(
      "Sent to 5 players in the app. 2 of the 3 players with phone notifications on got it there; the rest will see it in the app. 1 player also got it by email.",
    );
  });
});

describe("the notification bell", () => {
  beforeEach(() => {
    server = structuredClone(inbox);
    sessionStorage.clear();
    vi.clearAllMocks();
  });
  afterEach(() => vi.clearAllMocks());

  it("shows the unread count and opens by itself once a session", async () => {
    await renderBell();
    expect(await screen.findByText("2")).toBeTruthy();
    // Opened by itself: the list is showing.
    expect(await screen.findByText("Week 9 predictions")).toBeTruthy();
    expect(sessionStorage.getItem("op_inbox_opened")).toBe("user-1");
  });

  it("tapping one shows it in full and marks it read", async () => {
    await renderBell();
    const item = await screen.findByText("Fixture change");
    await act(async () => {
      fireEvent.click(item);
    });
    expect(markRead).toHaveBeenCalledWith("b");
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("Moved to Sunday, and the full reason is right here.");
    expect(dialog.textContent).toContain("From the admins");
    await waitFor(() => expect(screen.getByLabelText("Notifications, 1 unread")).toBeTruthy());
  });

  it("✕ deletes one; Mark all as read clears the count", async () => {
    await renderBell();
    await screen.findByText("Fixture change");

    await act(async () => {
      fireEvent.click(screen.getAllByLabelText("Delete")[0]);
    });
    expect(remove).toHaveBeenCalledWith("a");
    await waitFor(() => expect(screen.queryByText("Week 9 predictions")).toBeNull());
    await waitFor(() => expect(screen.getByLabelText("Notifications, 1 unread")).toBeTruthy());

    await act(async () => {
      fireEvent.click(screen.getByText("Mark all as read"));
    });
    expect(markAllRead).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByLabelText("Notifications")).toBeTruthy());
  });

  it("closes the phone's notifications once nothing is unread", async () => {
    const { clearShownNotifications } = await import("@/lib/push");
    server.items = server.items.map((i) => ({ ...i, read: true }));
    recount();
    await renderBell();
    await waitFor(() => expect(clearShownNotifications).toHaveBeenCalledWith("inbox"));
  });

  it("links to the Notifications page", async () => {
    await renderBell();
    expect((await screen.findByText("See all notifications")).closest("a")?.getAttribute("href")).toBe("/notifications");
  });

  it("doesn't open by itself again in the same session", async () => {
    sessionStorage.setItem("op_inbox_opened", "user-1");
    await renderBell();
    expect(await screen.findByText("2")).toBeTruthy();
    expect(screen.queryByText("Week 9 predictions")).toBeNull();
  });
});
