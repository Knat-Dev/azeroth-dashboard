"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

interface BanEntry {
  id: number;
  accountId: number;
  username: string;
  reason: string;
  bannedBy: string;
  banDate: string;
  unbanDate: string;
}

export default function BansPage() {
  const [bans, setBans] = useState<BanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unbanning, setUnbanning] = useState<number | null>(null);

  const fetchBans = useCallback(() => {
    setLoading(true);
    setError("");
    api
      .get<BanEntry[]>("/admin/bans")
      .then(setBans)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchBans();
  }, [fetchBans]);

  function handleUnban(accountId: number) {
    setUnbanning(accountId);
    setError("");
    api
      .delete(`/admin/accounts/${accountId}/ban`)
      .then(() => {
        fetchBans();
      })
      .catch((e) => setError(e.message))
      .finally(() => setUnbanning(null));
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function isPermanent(unbanDate: string) {
    if (!unbanDate) return true;
    const d = new Date(unbanDate);
    return d.getFullYear() > 9000;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ban Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {bans.length} active ban{bans.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={fetchBans}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-muted-foreground">Loading bans...</div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Account
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Reason
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Banned By
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Ban Date
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Unban Date
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {bans.map((ban) => (
                <tr
                  key={ban.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3">
                    <div>
                      <span className="font-medium text-foreground">
                        {ban.username}
                      </span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        #{ban.accountId}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground">{ban.reason}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {ban.bannedBy}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(ban.banDate)}
                  </td>
                  <td className="px-4 py-3">
                    {isPermanent(ban.unbanDate) ? (
                      <span className="inline-block rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                        Permanent
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {formatDate(ban.unbanDate)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleUnban(ban.accountId)}
                      disabled={unbanning === ban.accountId}
                      className="rounded-lg bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
                    >
                      {unbanning === ban.accountId ? "Unbanning..." : "Unban"}
                    </button>
                  </td>
                </tr>
              ))}
              {bans.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No active bans.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
