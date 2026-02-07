"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Server,
  Users,
  Radio,
  RefreshCw,
  Send,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Activity,
  Clock,
} from "lucide-react";

interface HealthState {
  worldserver: { state: string; status: string };
  authserver: { state: string; status: string };
  soap: { connected: boolean };
  players: { online: number };
  lastUpdated: string;
}

interface ServerEvent {
  id: number;
  timestamp: string;
  container: string;
  event_type: string;
  details: string | null;
  duration_ms: number | null;
}

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function shortenContainer(container: string): string {
  if (container.includes("worldserver")) return "World";
  if (container.includes("authserver")) return "Auth";
  return container;
}

function eventTypeColor(eventType: string): string {
  const red = ["crash", "restart_failed", "crash_loop"];
  const green = ["restart_attempt", "restart_success", "recovery"];
  const yellow = ["soap_degraded", "soap_recovered"];
  if (red.includes(eventType)) return "text-red-400";
  if (green.includes(eventType)) return "text-green-400";
  if (yellow.includes(eventType)) return "text-yellow-400";
  return "text-muted-foreground";
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
}

function StatusBadge({ state }: { state: string }) {
  const isRunning = state === "running";
  const isStopped = ["exited", "dead", "stopped"].includes(state);
  const isRestarting = state === "restarting";

  if (isRunning)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-400">
        <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
        Running
      </span>
    );

  if (isStopped)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400">
        <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
        Stopped
      </span>
    );

  if (isRestarting)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/10 px-2.5 py-1 text-xs font-medium text-yellow-400">
        <div className="h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse" />
        Restarting
      </span>
    );

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
      <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
      Unknown
    </span>
  );
}

function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  loading,
}: {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-lg bg-yellow-500/10 p-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-secondary transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Restarting...
              </span>
            ) : (
              "Restart"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [health, setHealth] = useState<HealthState | null>(null);
  const [error, setError] = useState("");

  // Restart state
  const [restartTarget, setRestartTarget] = useState<string | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [restartResult, setRestartResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Events state
  const [events, setEvents] = useState<ServerEvent[]>([]);

  // Broadcast state
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastType, setBroadcastType] = useState<"announce" | "notify" | "both">("announce");
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

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
    api
      .get<ServerEvent[]>("/server/events?limit=10")
      .then(setEvents)
      .catch(() => {});
  }, []);

  async function handleRestart() {
    if (!restartTarget) return;
    setRestarting(true);
    setRestartResult(null);
    try {
      if (restartTarget === "all") {
        await api.post("/admin/restart/ac-worldserver");
        await api.post("/admin/restart/ac-authserver");
      } else {
        await api.post(`/admin/restart/${restartTarget}`);
      }
      setRestartResult({ type: "success", message: `${restartTarget === "all" ? "All servers" : restartTarget} restarted successfully` });
      void fetchHealth();
    } catch (e) {
      setRestartResult({ type: "error", message: e instanceof Error ? e.message : "Restart failed" });
    } finally {
      setRestarting(false);
      setRestartTarget(null);
    }
  }

  async function handleBroadcast(e: React.FormEvent) {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;

    setBroadcasting(true);
    setBroadcastResult(null);
    try {
      await api.post("/admin/broadcast", {
        message: broadcastMessage.trim(),
        type: broadcastType,
      });
      setBroadcastResult({ type: "success", message: "Broadcast sent successfully" });
      setBroadcastMessage("");
    } catch (err) {
      setBroadcastResult({
        type: "error",
        message: err instanceof Error ? err.message : "Broadcast failed",
      });
    } finally {
      setBroadcasting(false);
    }
  }

  // Clear results after 4 seconds
  useEffect(() => {
    if (restartResult) {
      const t = setTimeout(() => setRestartResult(null), 4000);
      return () => clearTimeout(t);
    }
  }, [restartResult]);

  useEffect(() => {
    if (broadcastResult) {
      const t = setTimeout(() => setBroadcastResult(null), 4000);
      return () => clearTimeout(t);
    }
  }, [broadcastResult]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Server health overview and quick actions
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Health Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="rounded-lg bg-secondary p-2">
              <Server className="h-4 w-4 text-primary" />
            </div>
            <StatusBadge state={health?.worldserver.state ?? "unknown"} />
          </div>
          <p className="text-sm text-muted-foreground">Worldserver</p>
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            {health?.worldserver.status || "—"}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="rounded-lg bg-secondary p-2">
              <Server className="h-4 w-4 text-blue-400" />
            </div>
            <StatusBadge state={health?.authserver.state ?? "unknown"} />
          </div>
          <p className="text-sm text-muted-foreground">Authserver</p>
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            {health?.authserver.status || "—"}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="rounded-lg bg-secondary p-2">
              <Radio className="h-4 w-4 text-emerald-400" />
            </div>
            {health?.soap.connected ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-400">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400">
                <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                Disconnected
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">SOAP Interface</p>
          <p className="text-xs text-muted-foreground/70 mt-0.5">Remote command bridge</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="rounded-lg bg-secondary p-2">
              <Users className="h-4 w-4 text-violet-400" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Players Online</p>
          <p className="mt-1 text-3xl font-bold text-foreground">
            {health?.players.online ?? "—"}
          </p>
        </div>
      </div>

      {/* Quick Actions + Broadcast */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Quick Actions
          </h2>

          {restartResult && (
            <div
              className={`mb-4 flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm ${
                restartResult.type === "success"
                  ? "bg-green-500/10 text-green-400"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {restartResult.type === "success" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              {restartResult.message}
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={() => setRestartTarget("ac-worldserver")}
              className="flex w-full items-center gap-3 rounded-lg border border-border px-4 py-3 text-left text-sm transition-colors hover:bg-secondary"
            >
              <RefreshCw className="h-4 w-4 text-primary" />
              <div>
                <p className="font-medium text-foreground">Restart Worldserver</p>
                <p className="text-xs text-muted-foreground">
                  Restarts the game server container
                </p>
              </div>
            </button>

            <button
              onClick={() => setRestartTarget("ac-authserver")}
              className="flex w-full items-center gap-3 rounded-lg border border-border px-4 py-3 text-left text-sm transition-colors hover:bg-secondary"
            >
              <RefreshCw className="h-4 w-4 text-blue-400" />
              <div>
                <p className="font-medium text-foreground">Restart Authserver</p>
                <p className="text-xs text-muted-foreground">
                  Restarts the authentication server container
                </p>
              </div>
            </button>

            <button
              onClick={() => setRestartTarget("all")}
              className="flex w-full items-center gap-3 rounded-lg border border-border px-4 py-3 text-left text-sm transition-colors hover:bg-secondary"
            >
              <RefreshCw className="h-4 w-4 text-yellow-400" />
              <div>
                <p className="font-medium text-foreground">Restart All</p>
                <p className="text-xs text-muted-foreground">
                  Restarts both worldserver and authserver
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Broadcast */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Broadcast Message
          </h2>

          {broadcastResult && (
            <div
              className={`mb-4 flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm ${
                broadcastResult.type === "success"
                  ? "bg-green-500/10 text-green-400"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {broadcastResult.type === "success" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              {broadcastResult.message}
            </div>
          )}

          <form onSubmit={handleBroadcast} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Message
              </label>
              <input
                type="text"
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Enter your broadcast message..."
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Type
              </label>
              <div className="flex gap-2">
                {(["announce", "notify", "both"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setBroadcastType(type)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      broadcastType === type
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {type === "announce"
                      ? "Chat"
                      : type === "notify"
                        ? "Popup"
                        : "Both"}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={broadcasting || !broadcastMessage.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {broadcasting ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Send Broadcast
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Recent Events */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Events
          </h2>
        </div>

        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events recorded yet</p>
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0 w-16">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(event.timestamp)}
                </span>
                <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-xs font-medium text-foreground">
                  {shortenContainer(event.container)}
                </span>
                <span className={`shrink-0 text-xs font-medium ${eventTypeColor(event.event_type)}`}>
                  {event.event_type}
                </span>
                {event.details && (
                  <span className="truncate text-xs text-muted-foreground" title={event.details}>
                    {event.details}
                  </span>
                )}
                {event.duration_ms != null && (
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {formatDuration(event.duration_ms)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={restartTarget !== null}
        title="Confirm Restart"
        message={
          restartTarget === "all"
            ? "This will restart both the worldserver and authserver. All online players will be disconnected."
            : `This will restart ${restartTarget}. ${restartTarget === "ac-worldserver" ? "All online players will be disconnected." : "Players may experience brief login issues."}`
        }
        onConfirm={handleRestart}
        onCancel={() => setRestartTarget(null)}
        loading={restarting}
      />
    </div>
  );
}
