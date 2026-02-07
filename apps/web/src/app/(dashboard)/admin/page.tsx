"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  Server,
  Users,
  UserCog,
  Ban,
  Terminal,
  Radio,
  FileText,
  Database,
} from "lucide-react";

interface AdminStats {
  serverOnline: boolean;
  onlinePlayers: number;
  totalAccounts: number;
  recentAccounts: number;
  activeBans: number;
}

function StatCard({
  icon: Icon,
  label,
  value,
  color = "text-primary",
}: {
  icon: typeof Server;
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

const quickActions = [
  { href: "/admin/accounts", label: "Manage Accounts", icon: UserCog },
  { href: "/admin/bans", label: "Manage Bans", icon: Ban },
  { href: "/admin/console", label: "SOAP Console", icon: Terminal },
  { href: "/admin/broadcast", label: "Broadcast", icon: Radio },
  { href: "/admin/logs", label: "View Logs", icon: FileText },
  { href: "/admin/backups", label: "Backups", icon: Database },
];

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<AdminStats>("/admin/stats")
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">
        Admin Overview
      </h1>

      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-muted-foreground">Loading stats...</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Server}
              label="Server Status"
              value={stats?.serverOnline ? "Online" : "Offline"}
              color={stats?.serverOnline ? "text-green-400" : "text-destructive"}
            />
            <StatCard
              icon={Users}
              label="Players Online"
              value={stats?.onlinePlayers ?? 0}
            />
            <StatCard
              icon={UserCog}
              label="Recent Accounts (24h)"
              value={stats?.recentAccounts ?? 0}
              color="text-muted-foreground"
            />
            <StatCard
              icon={Ban}
              label="Active Bans"
              value={stats?.activeBans ?? 0}
              color="text-destructive"
            />
          </div>

          <div className="mt-8">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Quick Actions
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
                >
                  <action.icon className="h-5 w-5" />
                  <span className="text-sm font-medium">{action.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
