"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Users, Server, Clock, Activity } from "lucide-react";

interface ServerStatus {
  online: boolean;
  playerCount: number;
  realmName: string;
  realms: { id: number; name: string; population: number }[];
}

function StatCard({
  icon: Icon,
  label,
  value,
  color = "text-primary",
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg bg-secondary p-2 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<ServerStatus>("/server/status")
      .then(setStatus)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">Dashboard</h1>

      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Server}
          label="Server Status"
          value={status?.online ? "Online" : "Offline"}
          color={status?.online ? "text-green-400" : "text-destructive"}
        />
        <StatCard
          icon={Users}
          label="Players Online"
          value={status?.playerCount ?? 0}
        />
        <StatCard
          icon={Activity}
          label="Realm"
          value={status?.realmName ?? "..."}
          color="text-accent"
        />
        <StatCard
          icon={Clock}
          label="Realms"
          value={status?.realms?.length ?? 0}
          color="text-muted-foreground"
        />
      </div>

      {status?.realms && status.realms.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Realms</h2>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">ID</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Population</th>
                </tr>
              </thead>
              <tbody>
                {status.realms.map((realm) => (
                  <tr key={realm.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-foreground">{realm.id}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{realm.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{realm.population}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
