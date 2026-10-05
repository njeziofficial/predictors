import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  getStoredUser,
  saveAuth,
  clearAuth,
  updateStoredUser,
  AUTH_CHANGED_EVENT,
  type StoredUser,
} from "@/lib/auth";
import { api } from "@/lib/api";

interface AppState {
  currentUser: StoredUser | null;
  login: (token: string, user: StoredUser) => void;
  logout: () => void;
  updateUser: (patch: Partial<StoredUser>) => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(getStoredUser);

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
  }, []);

  const login = (token: string, user: StoredUser) => {
    saveAuth(token, user);
    setCurrentUser(user);
  };

  const logout = () => {
    // Fire-and-forget: the local sign-out shouldn't wait on (or fail because of) the network.
    api.auth.logout().catch(() => {});
    clearAuth();
    setCurrentUser(null);
  };

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
