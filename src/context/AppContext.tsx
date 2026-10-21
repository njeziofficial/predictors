import React, { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getStoredUser,
  saveAuth,
  clearAuth,
  updateStoredUser,
  AUTH_CHANGED_EVENT,
  type StoredUser,
} from "@/lib/auth";
import { api } from "@/lib/api";
import { clearShownNotifications, forgetPushOnThisDevice, syncPushSubscription } from "@/lib/push";
import { resetActivity } from "@/lib/idleTimeout";

interface AppState {
  currentUser: StoredUser | null;
  login: (token: string, user: StoredUser) => void;
  logout: () => void;
  updateUser: (patch: Partial<StoredUser>) => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUserState] = useState<StoredUser | null>(getStoredUser);
  const queryClient = useQueryClient();

  // Cached responses belong to whoever fetched them (predictions, profile, admin lists, chats).
  // Drop them all when the signed-in account changes, so the next person on this browser never
  // sees the last one's data, even for a moment. This happens before the new user is set, not in
  // an effect: children's effects run first, so queries that start on sign-in (the competitions
  // list) would already be fetching, and clearing then cancels them for good.
  const cachedForUser = useRef(currentUser?.id ?? null);
  const setCurrentUser = useCallback(
    (user: StoredUser | null) => {
      const id = user?.id ?? null;
      if (id !== cachedForUser.current) {
        cachedForUser.current = id;
        queryClient.clear();
      }
      setCurrentUserState(user);
    },
    [queryClient],
  );

  // This browser's push subscription follows whoever is signed in (see lib/push.ts).
  useEffect(() => {
    if (currentUser?.id) void syncPushSubscription();
  }, [currentUser?.id]);

  // Back in the app: chat notifications on the phone have done their job, and the in-app list
  // is refreshed. The other notifications (and the launcher's count) stay until they're read
  // in the app; NotificationBell clears them then.
  useEffect(() => {
    if (!currentUser?.id) return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void clearShownNotifications("chats");
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
    };
    onVisible();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [currentUser?.id, queryClient]);

  // Keep currentUser in step with storage when it changes outside React: a silent token
  // refresh in this tab, or a login/logout/refresh in another tab.
  useEffect(() => {
    const sync = () => setCurrentUser(getStoredUser());
    window.addEventListener(AUTH_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [setCurrentUser]);

  const login = (token: string, user: StoredUser) => {
    // A fresh sign-in starts the idle sign-out clock again (see IdleSignOut).
    resetActivity();
    saveAuth(token, user);
    setCurrentUser(user);
  };

  // Stable, so IdleSignOut's listeners aren't set up again on every render.
  const logout = useCallback(() => {
    // Fire-and-forget: the local sign-out shouldn't wait on (or fail because of) the network.
    api.auth.logout().catch(() => {});
    void forgetPushOnThisDevice();
    clearAuth();
    setCurrentUser(null);
  }, [setCurrentUser]);

  const updateUser = (patch: Partial<StoredUser>) => {
    const updated = updateStoredUser(patch);
    if (updated) setCurrentUser(updated);
  };

  return (
    <AppContext.Provider value={{ currentUser, login, logout, updateUser }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be inside AppProvider");
  return ctx;
};
