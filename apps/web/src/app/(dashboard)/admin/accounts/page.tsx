"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

interface Account {
  id: number;
  username: string;
  email: string;
  gmLevel: number;
  lastLogin: string;
}

interface AccountsResponse {
  data: Account[];
  total: number;
  page: number;
  totalPages: number;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [banningId, setBanningId] = useState<number | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banDuration, setBanDuration] = useState("");
  const [showBanModal, setShowBanModal] = useState(false);

  const fetchAccounts = useCallback((p: number) => {
    setLoading(true);
    setError("");
    api
      .get<AccountsResponse>(`/admin/accounts?page=${p}&limit=20`)
      .then((res) => {
        setAccounts(res.data);
        setTotalPages(res.totalPages);
        setTotal(res.total);
        setPage(res.page);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAccounts(1);
  }, [fetchAccounts]);

  function openBanModal(accountId: number) {
    setBanningId(accountId);
    setBanReason("");
    setBanDuration("");
    setShowBanModal(true);
  }

  function closeBanModal() {
    setShowBanModal(false);
    setBanningId(null);
    setBanReason("");
    setBanDuration("");
  }

  function handleBan() {
    if (!banningId || !banReason.trim()) return;
    setError("");
    api
      .post(`/admin/accounts/${banningId}/ban`, {
        reason: banReason,
        duration: banDuration || undefined,
      })
      .then(() => {
        closeBanModal();
        fetchAccounts(page);
      })
      .catch((e) => setError(e.message));
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return "Never";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Account Management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} total accounts
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-muted-foreground">Loading accounts...</div>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    ID
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Username
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    GM Level
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Last Login
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr
                    key={account.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3 font-mono text-foreground">
                      {account.id}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {account.username}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {account.email || "-"}
                    </td>
                    <td className="px-4 py-3">
                      {account.gmLevel > 0 ? (
                        <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          GM {account.gmLevel}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Player</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(account.lastLogin)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openBanModal(account.id)}
                        className="rounded-lg bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors"
                      >
                        Ban
                      </button>
                    </td>
                  </tr>
                ))}
                {accounts.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No accounts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => fetchAccounts(page - 1)}
                disabled={page <= 1}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-secondary disabled:opacity-50 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => fetchAccounts(page + 1)}
                disabled={page >= totalPages}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-secondary disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {showBanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6">
            <h3 className="mb-4 text-lg font-semibold text-foreground">
              Ban Account #{banningId}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Reason
                </label>
                <input
                  type="text"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter ban reason"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Duration (e.g. 7d, 30d, permanent)
                </label>
                <input
                  type="text"
                  value={banDuration}
                  onChange={(e) => setBanDuration(e.target.value)}
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Leave blank for permanent"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={closeBanModal}
                className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBan}
                disabled={!banReason.trim()}
                className="rounded-lg bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50 transition-colors"
              >
                Confirm Ban
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
