import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { badgeText } from "@/lib/notificationCount";
import type { InboxDto } from "@/lib/api";

const inbox: InboxDto = {
  unread: 2,
  items: [
    { id: "a", kind: "reminder", title: "Week 9 predictions", body: "La Liga kicks off in 3 hours.", url: "/predict", createdAt: new Date().toISOString(), read: false },
    { id: "b", kind: "announcement", title: "Fixture change", body: "Moved to Sunday.", url: "/predict", createdAt: new Date().toISOString(), read: false },
  ],
};

// Stands in for the server: remembers what was read, as the real one does.
let server: InboxDto = structuredClone(inbox);
const markRead = vi.fn(async (id: string) => {
  server.items = server.items.map((i) => (i.id === id ? { ...i, read: true } : i));
  server.unread = server.items.filter((i) => !i.read).length;
});
const markAllRead = vi.fn(async () => {
  server.items = server.items.map((i) => ({ ...i, read: true }));
  server.unread = 0;
});
vi.mock("@/lib/api", () => ({
  api: {
    notifications: {
      list: vi.fn(() => Promise.resolve(structuredClone(server))),
      markRead: (id: string) => markRead(id),
      markAllRead: () => markAllRead(),
    },
  },
}));
vi.mock("@/context/AppContext", () => ({ useApp: () => ({ currentUser: { id: "user-1", name: "Pat" } }) }));

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

describe("the notification bell", () => {
  beforeEach(() => {
    server = structuredClone(inbox);
    sessionStorage.clear();
    markRead.mockClear();
    markAllRead.mockClear();
  });
  afterEach(() => vi.clearAllMocks());

  it("shows the unread count and opens by itself once a session", async () => {
    await renderBell();
    expect(await screen.findByText("2")).toBeTruthy();
    // Opened by itself: the list is showing.
    expect(await screen.findByText("Week 9 predictions")).toBeTruthy();
    expect(sessionStorage.getItem("op_inbox_opened")).toBe("user-1");
  });

  it("dismissing one lowers the count; Mark all as read clears it", async () => {
    await renderBell();
    await screen.findByText("Fixture change");

    await act(async () => {
      fireEvent.click(screen.getAllByLabelText("Dismiss")[0]);
    });
    expect(markRead).toHaveBeenCalledWith("a");
    await waitFor(() => expect(screen.getByLabelText("Notifications, 1 unread")).toBeTruthy());

    await act(async () => {
      fireEvent.click(screen.getByText("Mark all as read"));
    });
    expect(markAllRead).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByLabelText("Notifications")).toBeTruthy());
  });

  it("doesn't open by itself again in the same session", async () => {
    sessionStorage.setItem("op_inbox_opened", "user-1");
    await renderBell();
    expect(await screen.findByText("2")).toBeTruthy();
    expect(screen.queryByText("Week 9 predictions")).toBeNull();
  });
});
