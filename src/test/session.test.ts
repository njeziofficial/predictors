import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { getToken, saveAuth } from "@/lib/auth";

// A token that has already expired, so the next request refreshes first.
const expiredToken = () => {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 60 }));
  return `h.${payload}.s`;
};

const user = { id: "u1", name: "Pat", email: "pat@test", role: "user" as const, mustResetPassword: false, isSystemUser: false };

describe("staying signed in", () => {
  const replace = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    saveAuth(expiredToken(), user);
    vi.stubGlobal("location", { ...window.location, replace });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    replace.mockReset();
  });

  it.each([502, 503, 504])("keeps the session when the server answers %i (asleep or waking)", async (status) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status })));
    await expect(api.notifications.list()).rejects.toThrow(/Can't reach the server/);
    expect(getToken()).not.toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it("keeps the session when the phone is offline", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    await expect(api.notifications.list()).rejects.toThrow();
    expect(getToken()).not.toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it("signs out when the server says the session is over", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    await expect(api.notifications.list()).rejects.toThrow(/Session expired/);
    expect(getToken()).toBeNull();
    expect(replace).toHaveBeenCalledWith("/");
  });
});
