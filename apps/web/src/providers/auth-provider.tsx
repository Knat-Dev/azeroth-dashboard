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
  register: (username: string, password: string, email?: string) => Promise<void>;
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

  const register = useCallback(
    async (username: string, password: string, email?: string) => {
      const res = await api.post<{ accessToken: string; user: User }>(
        "/auth/register",
        { username, password, email },
      );
      api.setToken(res.accessToken);
      storeAuth(res.accessToken, res.user);
      setUser(res.user);
    },
    [],
  );

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

  return (
    <AuthContext value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
