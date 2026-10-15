import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { StoredUser } from "@/lib/auth";

let currentUser: StoredUser | null = null;
vi.mock("@/context/AppContext", () => ({ useApp: () => ({ currentUser, login: vi.fn() }) }));
vi.mock("@/lib/api", () => ({ api: { auth: { registrationStatus: vi.fn(async () => ({ open: true })) } } }));

const player: StoredUser = { id: "u1", name: "Pat", email: "p@t", role: "user", mustResetPassword: false, isSystemUser: false };

const openApp = async () => {
  const { default: Login } = await import("@/pages/Login");
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/predict" element={<p>predict page</p>} />
          <Route path="/choose" element={<p>choose page</p>} />
          <Route path="/reset-password-required" element={<p>reset page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("opening the installed app (it starts on the sign-in page)", () => {
  it("goes straight in when already signed in", async () => {
    currentUser = player;
    await openApp();
    expect(screen.getByText("predict page")).toBeTruthy();
  });

  it("takes an admin to the choice of sides", async () => {
    currentUser = { ...player, role: "admin" };
    await openApp();
    expect(screen.getByText("choose page")).toBeTruthy();
  });

  it("sends someone who must reset their password to do that", async () => {
    currentUser = { ...player, mustResetPassword: true };
    await openApp();
    expect(screen.getByText("reset page")).toBeTruthy();
  });

  it("shows the sign-in form when signed out", async () => {
    currentUser = null;
    await openApp();
    expect(screen.queryByText("predict page")).toBeNull();
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
  });
});
