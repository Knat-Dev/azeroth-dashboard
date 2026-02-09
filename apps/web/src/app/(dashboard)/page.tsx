"use client";

import { PlayerChart } from "@/components/dashboard/player-chart";
import { ContainerStatsChart } from "@/components/dashboard/container-stats-chart";
import { DistributionCharts } from "@/components/dashboard/distribution-charts";
import { useDashboard } from "@/hooks/use-dashboard";
import { parseUTC } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  Clock,
  Radio,
  RefreshCw,
  Server,
  Users,
} from "lucide-react";

function formatRelativeTime(timestamp: string): string {
  const diffMs = Date.now() - parseUTC(timestamp).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function shortenContainer(c: string): string {
  if (c.includes("worldserver")) return "World";
  if (c.includes("authserver")) return "Auth";
  return c;
}

function eventTypeColor(t: string): string {
  if (["crash", "restart_failed", "crash_loop"].includes(t)) return "text-red-400";
  if (["restart_attempt", "restart_success", "recovery"].includes(t)) return "text-green-400";
  if (["soap_degraded", "soap_recovered"].includes(t)) return "text-yellow-400";
  return "text-muted-foreground";
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

function StatusDot({ state }: { state: string }) {
  if (state === "running")
    return <div className="h-2 w-2 rounded-full bg-green-500 pulse-glow" />;
  if (["exited", "dead", "stopped", "unresponsive", "crashed"].includes(state))
    return <div className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />;
  if (state === "restarting")
    return <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />;
  return <div className="h-2 w-2 rounded-full bg-muted-foreground" />;
}

function ConfirmDialog({
  open, title, message, onConfirm, onCancel, loading,
}: {
  open: boolean; title: string; message: string;
  onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-xl glass p-6 shadow-lg">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-lg bg-yellow-500/10 p-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-secondary transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Restarting...
              </span>
            ) : "Restart"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const {
    health, error, restartTarget, setRestartTarget, restarting, events, handleRestart,
  } = useDashboard();

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
      )}

      {/* Row 1: Health indicators */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:scale-[1.02] hover:-translate-y-0.5 transition-all duration-200">
          <Server className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">
              {health?.realmName && health.realmName !== "Unknown" ? health.realmName : "Worldserver"}
            </p>
            {health?.uptime ? (
              <p className="truncate text-xs text-muted-foreground/70">Up: {health.uptime}</p>
            ) : health?.worldserver.status ? (
              <p className="truncate text-xs text-muted-foreground/70">{health.worldserver.status}</p>
            ) : null}
          </div>
          <StatusDot state={health?.worldserver.state ?? "unknown"} />
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:scale-[1.02] hover:-translate-y-0.5 transition-all duration-200">
          <Server className="h-4 w-4 shrink-0 text-blue-400" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Authserver</p>
            {health?.authserver.status && (
              <p className="truncate text-xs text-muted-foreground/70">{health.authserver.status}</p>
            )}
          </div>
          <StatusDot state={health?.authserver.state ?? "unknown"} />
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:scale-[1.02] hover:-translate-y-0.5 transition-all duration-200">
          <Radio className="h-4 w-4 shrink-0 text-emerald-400" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">SOAP</p>
            <p className="text-xs text-muted-foreground/70">Command bridge</p>
          </div>
          <StatusDot state={health?.soap.connected ? "running" : "exited"} />
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:scale-[1.02] hover:-translate-y-0.5 transition-all duration-200">
          <Users className="h-4 w-4 shrink-0 text-violet-400" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Players</p>
          </div>
          <p className="text-xl font-bold text-foreground">{health?.players.online ?? "\u2014"}</p>
        </div>
      </div>

      {/* Row 2: Chart + Quick Actions */}
      <div className="grid gap-4 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <PlayerChart />
        </div>

        <div className="flex flex-col rounded-xl glass p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Quick Actions
          </h2>

          <div className="flex flex-1 flex-col gap-2">
            <button onClick={() => setRestartTarget("ac-worldserver")}
              className="group flex flex-1 items-center gap-3 rounded-lg border border-border px-3 transition-colors hover:border-primary/40 hover:bg-primary/5">
              <div className="rounded-md bg-primary/10 p-1.5">
                <RefreshCw className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-xs font-medium text-foreground">Worldserver</p>
                <p className="text-[10px] text-muted-foreground">Restart game server</p>
              </div>
            </button>
            <button onClick={() => setRestartTarget("ac-authserver")}
              className="group flex flex-1 items-center gap-3 rounded-lg border border-border px-3 transition-colors hover:border-blue-400/40 hover:bg-blue-400/5">
              <div className="rounded-md bg-blue-400/10 p-1.5">
                <RefreshCw className="h-3.5 w-3.5 text-blue-400" />
              </div>
              <div className="text-left">
                <p className="text-xs font-medium text-foreground">Authserver</p>
                <p className="text-[10px] text-muted-foreground">Restart login server</p>
              </div>
            </button>
            <button onClick={() => setRestartTarget("all")}
              className="group flex flex-1 items-center gap-3 rounded-lg border border-border px-3 transition-colors hover:border-yellow-400/40 hover:bg-yellow-400/5">
              <div className="rounded-md bg-yellow-400/10 p-1.5">
                <RefreshCw className="h-3.5 w-3.5 text-yellow-400" />
              </div>
              <div className="text-left">
                <p className="text-xs font-medium text-foreground">All Servers</p>
                <p className="text-[10px] text-muted-foreground">Restart everything</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Row 3: Container Stats */}
      <ContainerStatsChart />

      {/* Row 4: Distribution Charts */}
      <DistributionCharts />

      {/* Row 5: Recent Events */}
      <div className="rounded-xl glass p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Recent Events
            </h2>
          </div>
          <a
            href="/events"
            className="text-xs text-primary hover:text-primary/80 transition-colors"
          >
            View All
          </a>
        </div>

        {events.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">No events recorded yet</p>
        ) : (
          <div className="divide-y divide-border">
            {events.map((event) => (
              <div key={event.id} className="flex items-center gap-3 py-1.5 text-xs">
                <span className="flex items-center gap-1 text-muted-foreground shrink-0 w-16 whitespace-nowrap">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(event.timestamp)}
                </span>
                <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 font-medium text-foreground">
                  {shortenContainer(event.container)}
                </span>
                <span className={`shrink-0 font-medium ${eventTypeColor(event.event_type)}`}>
                  {event.event_type}
                </span>
                {event.details && (
                  <span className="truncate text-muted-foreground" title={event.details}>
                    {event.details}
                  </span>
                )}
                {event.duration_ms != null && (
                  <span className="ml-auto shrink-0 text-muted-foreground">
                    {formatDuration(event.duration_ms)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={restartTarget !== null}
        title="Confirm Restart"
        message={
          restartTarget === "all"
            ? "This will restart both servers. All online players will be disconnected."
            : `This will restart ${restartTarget}. ${restartTarget === "ac-worldserver" ? "All online players will be disconnected." : "Players may experience brief login issues."}`
        }
        onConfirm={handleRestart}
        onCancel={() => setRestartTarget(null)}
        loading={restarting}
      />
    </div>
  );
}
