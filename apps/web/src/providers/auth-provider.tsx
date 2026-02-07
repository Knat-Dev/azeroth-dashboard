"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import {
  type User,
  getStoredToken,
  getStoredUser,
  storeAuth,
  clearAuth,
} from "@/lib/auth";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getStoredToken();
    const storedUser = getStoredUser();
    if (token && storedUser) {
      api.setToken(token);
      setUser(storedUser);
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.post<{ accessToken: string; user: User }>(
      "/auth/login",
      { username, password },
    );
    api.setToken(res.accessToken);
    storeAuth(res.accessToken, res.user);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    api.setToken(null);
    api.setOnUnauthorized(null);
    clearAuth();
    setUser(null);
  }, []);

  useEffect(() => {
    api.setOnUnauthorized(() => {
      logout();
    });
    return () => api.setOnUnauthorized(null);
  }, [logout]);

  // Silent token refresh every 20 minutes
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      try {
        const res = await api.post<{ accessToken: string; user: User }>("/auth/refresh");
        api.setToken(res.accessToken);
        storeAuth(res.accessToken, res.user);
        setUser(res.user);
      } catch {
        // Refresh failed — token may be expired, will get caught by 401 handler
      }
    }, 20 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <AuthContext value={{ user, loading, login, logout }}>
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
