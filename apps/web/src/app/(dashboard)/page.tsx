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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl">
        <div className="mb-3 flex items-center gap-3">
          <div className="rounded-lg bg-yellow-500/10 p-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} disabled={loading}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="rounded-lg bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50">
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

const RESTART_TARGETS = [
  { id: "ac-worldserver", label: "Worldserver", desc: "Restart game server", color: "primary" },
  { id: "ac-authserver", label: "Authserver", desc: "Restart login server", color: "blue-400" },
  { id: "all", label: "All Servers", desc: "Restart everything", color: "yellow-400" },
] as const;

export default function DashboardPage() {
  const {
    health, error, restartTarget, setRestartTarget, restarting, events, handleRestart,
  } = useDashboard();

  return (
    <div className="flex flex-col gap-3 xl:h-full xl:overflow-hidden">
      {error && (
        <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
      )}

      {/* Health indicators + Quick actions — single compact row */}
      <div className="flex flex-wrap items-stretch gap-2 shrink-0">
        <div className="flex flex-1 basis-36 items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5">
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

        <div className="flex flex-1 basis-36 items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5">
          <Server className="h-4 w-4 shrink-0 text-blue-400" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Authserver</p>
            {health?.authserver.status && (
              <p className="truncate text-xs text-muted-foreground/70">{health.authserver.status}</p>
            )}
          </div>
          <StatusDot state={health?.authserver.state ?? "unknown"} />
        </div>

        <div className="flex flex-1 basis-36 items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5">
          <Radio className="h-4 w-4 shrink-0 text-emerald-400" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">SOAP</p>
            <p className="text-xs text-muted-foreground/70">Command bridge</p>
          </div>
          <StatusDot state={health?.soap.connected ? "running" : "exited"} />
        </div>

        <div className="flex flex-1 basis-36 items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5">
          <Users className="h-4 w-4 shrink-0 text-violet-400" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Players</p>
          </div>
          <p className="text-xl font-bold text-foreground">{health?.players.online ?? "\u2014"}</p>
        </div>

        {RESTART_TARGETS.map((t) => (
          <button
            key={t.id}
            onClick={() => setRestartTarget(t.id)}
            className={`hidden lg:flex flex-1 basis-28 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 transition-colors hover:border-${t.color}/40 hover:bg-${t.color}/5`}
          >
            <RefreshCw className={`h-3.5 w-3.5 text-${t.color}`} />
            <div className="text-left">
              <p className="text-xs font-medium text-foreground">{t.label}</p>
              <p className="text-[10px] text-muted-foreground">{t.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Mobile-only quick actions */}
      <div className="flex gap-2 lg:hidden shrink-0">
        {RESTART_TARGETS.map((t) => (
          <button
            key={t.id}
            onClick={() => setRestartTarget(t.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2 transition-colors hover:border-${t.color}/40 hover:bg-${t.color}/5`}
          >
            <RefreshCw className={`h-3.5 w-3.5 text-${t.color}`} />
            <span className="text-xs font-medium text-foreground">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Player chart */}
      <div className="shrink-0">
        <PlayerChart />
      </div>

      {/* Container stats */}
      <div className="shrink-0">
        <ContainerStatsChart />
      </div>

      {/* Distribution charts */}
      <div className="shrink-0">
        <DistributionCharts />
      </div>

      {/* Recent events — fills remaining viewport space */}
      <div className="flex-1 min-h-24 flex flex-col rounded-xl glass p-3">
        <div className="mb-1.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Recent Events
            </h2>
          </div>
          <a href="/events" className="text-xs text-primary hover:text-primary/80 transition-colors">
            View All
          </a>
        </div>

        {events.length === 0 ? (
          <p className="py-1 text-xs text-muted-foreground">No events recorded yet</p>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-border">
            {events.map((event) => (
              <div key={event.id} className="flex items-center gap-3 py-1.5 text-xs">
                <span className="flex items-center gap-1 text-muted-foreground shrink-0">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(event.timestamp)}
                </span>
                <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 font-medium text-foreground">
                  {shortenContainer(event.container)}
                </span>
                <span className={`shrink-0 font-medium ${eventTypeColor(event.event_type)}`}>
                  {event.event_type}
                </span>
                <span className="flex-1 min-w-0 truncate text-muted-foreground" title={event.details ?? ""}>
                  {event.details ?? ""}
                </span>
                {event.duration_ms != null && (
                  <span className="shrink-0 text-muted-foreground">
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
