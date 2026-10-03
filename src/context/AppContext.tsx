import React, { createContext, useContext, useState, type ReactNode } from "react";
import { getStoredUser, saveAuth, clearAuth, updateStoredUser, type StoredUser } from "@/lib/auth";

interface AppState {
  currentUser: StoredUser | null;
  login: (token: string, user: StoredUser) => void;
  logout: () => void;
  updateUser: (patch: Partial<StoredUser>) => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(getStoredUser);

  const login = (token: string, user: StoredUser) => {
    saveAuth(token, user);
    setCurrentUser(user);
  };

  const logout = () => {
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
