"use client";

import { useEffect, useState } from "react";
import type { HealthState } from "@repo/shared";
import { Menu } from "lucide-react";
import { api } from "@/lib/api";

function StatusDot({ state }: { state: "running" | "stopped" | "restarting" | "unknown" }) {
  const styles = {
    running: "bg-green-500 pulse-glow",
    stopped: "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]",
    restarting: "bg-yellow-500 animate-pulse",
    unknown: "bg-muted-foreground/50",
  };

  return <div className={`h-2 w-2 rounded-full ${styles[state]}`} />;
}

function mapState(state: string): "running" | "stopped" | "restarting" | "unknown" {
  if (state === "running") return "running";
  if (state === "restarting") return "restarting";
  if (["exited", "dead", "stopped", "unresponsive", "crashed"].includes(state)) return "stopped";
  return "unknown";
}

export function HealthBar({ onMenuClick }: { onMenuClick: () => void }) {
  const [health, setHealth] = useState<HealthState | null>(null);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const data = await api.get<HealthState>("/server/health");
        if (active) setHealth(data);
      } catch {
        // Silently fail — health bar just stays in last known state
      }
    }

    void poll();
    const interval = setInterval(poll, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const items = [
    {
      label: "World",
      state: health ? mapState(health.worldserver.state) : ("unknown" as const),
    },
    {
      label: "Auth",
      state: health ? mapState(health.authserver.state) : ("unknown" as const),
    },
    {
      label: "SOAP",
      state: health
        ? health.soap.connected
          ? ("running" as const)
          : ("stopped" as const)
        : ("unknown" as const),
    },
  ];

  return (
    <div className="flex items-center gap-4 border-b border-border glass px-4 md:px-6 py-2.5">
      <button className="md:hidden text-muted-foreground hover:text-foreground transition-colors" onClick={onMenuClick}>
        <Menu className="h-5 w-5" />
      </button>
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <StatusDot state={item.state} />
          <span className="text-xs text-muted-foreground">{item.label}</span>
        </div>
      ))}
      <div className="ml-auto flex items-center gap-2">
        <span className="text-xs font-medium text-foreground">
          {health?.players.online ?? "—"}
        </span>
        <span className="text-xs text-muted-foreground">online</span>
      </div>
    </div>
  );
}
