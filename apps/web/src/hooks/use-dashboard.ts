"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/providers/toast-provider";
import type { HealthState, ServerEvent } from "@repo/shared";

export function useDashboard() {
  const [health, setHealth] = useState<HealthState | null>(null);
  const [error, setError] = useState("");
  const [restartTarget, setRestartTarget] = useState<string | null>(null);
  const [restarting, setRestarting] = useState(false);
  const { toast } = useToast();
  const [events, setEvents] = useState<ServerEvent[]>([]);

  const fetchHealth = useCallback(async () => {
    try {
      const data = await api.get<HealthState>("/server/health");
      setHealth(data);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch health");
    }
  }, []);

  useEffect(() => {
    void fetchHealth();
    const interval = setInterval(fetchHealth, 5000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  useEffect(() => {
    api.get<ServerEvent[]>("/server/events?limit=10").then(setEvents).catch(() => {});
  }, []);

  async function handleRestart() {
    if (!restartTarget) return;
    setRestarting(true);
    try {
      if (restartTarget === "all") {
        await api.post("/admin/restart/ac-worldserver");
        await api.post("/admin/restart/ac-authserver");
      } else {
        await api.post(`/admin/restart/${restartTarget}`);
      }
      toast("success", `${restartTarget === "all" ? "All servers" : restartTarget} restarted`);
      void fetchHealth();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Restart failed");
    } finally {
      setRestarting(false);
      setRestartTarget(null);
    }
  }

  return {
    health,
    error,
    restartTarget,
    setRestartTarget,
    restarting,
    events,
    handleRestart,
  };
}
