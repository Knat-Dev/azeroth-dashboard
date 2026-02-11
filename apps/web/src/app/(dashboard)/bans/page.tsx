"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/providers/toast-provider";
import type { BanEntry, PaginatedResponse } from "@repo/shared";
import { Ban, Search, Plus, Globe } from "lucide-react";

const LIMIT = 20;

interface IpBanEntry {
  ip: string;
  reason: string;
  bannedBy: string;
  banDate: string;
  unbanDate: string | null;
}

export default function BansPage() {
  const [tab, setTab] = useState<"account" | "ip">("account");
  const { toast } = useToast();

  // --- Account Bans ---
  const [bans, setBans] = useState<BanEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unbanning, setUnbanning] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- IP Bans ---
  const [ipBans, setIpBans] = useState<IpBanEntry[]>([]);
  const [ipPage, setIpPage] = useState(1);
  const [ipTotalPages, setIpTotalPages] = useState(1);
  const [ipTotal, setIpTotal] = useState(0);
  const [ipLoading, setIpLoading] = useState(true);
  const [ipError, setIpError] = useState("");
  const [removingIp, setRemovingIp] = useState<string | null>(null);
  const [showIpBanModal, setShowIpBanModal] = useState(false);
  const [newIp, setNewIp] = useState("");
  const [newIpReason, setNewIpReason] = useState("");
  const [newIpDuration, setNewIpDuration] = useState("");

  const fetchBans = useCallback(
    (p: number, searchTerm?: string) => {
      setLoading(true);
      setError("");
      const term = searchTerm !== undefined ? searchTerm : debouncedSearch;
      let url = `/admin/bans?page=${p}&limit=${LIMIT}`;
      if (term) {
        url += `&search=${encodeURIComponent(term)}`;
      }
      api
        .get<PaginatedResponse<BanEntry>>(url)
        .then((res) => {
          setBans(res.data);
          setTotal(res.total);
          setPage(res.page);
          setTotalPages(Math.ceil(res.total / LIMIT));
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    },
    [debouncedSearch],
  );

  const fetchIpBans = useCallback((p: number) => {
    setIpLoading(true);
    setIpError("");
    api
      .get<PaginatedResponse<IpBanEntry>>(`/admin/ip-bans?page=${p}&limit=${LIMIT}`)
      .then((res) => {
        setIpBans(res.data);
        setIpTotal(res.total);
        setIpPage(res.page);
        setIpTotalPages(Math.ceil(res.total / LIMIT));
      })
      .catch((e) => setIpError(e.message))
      .finally(() => setIpLoading(false));
  }, []);

  useEffect(() => {
    fetchBans(1);
  }, [fetchBans]);

  useEffect(() => {
    if (tab === "ip") fetchIpBans(1);
  }, [tab, fetchIpBans]);

  function handleSearchChange(value: string) {
    setSearch(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(value), 300);
  }

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  useEffect(() => {
    fetchBans(1, debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  function handleUnban(accountId: number) {
    setUnbanning(accountId);
    api
      .delete(`/admin/accounts/${accountId}/ban`)
      .then(() => {
        toast("success", "Account unbanned");
        fetchBans(page);
      })
      .catch((e) => toast("error", e.message))
      .finally(() => setUnbanning(null));
  }

  function handleRemoveIpBan(ip: string) {
    setRemovingIp(ip);
    api
      .delete(`/admin/ip-bans/${encodeURIComponent(ip)}`)
      .then(() => {
        toast("success", "IP unbanned");
        fetchIpBans(ipPage);
      })
      .catch((e) => toast("error", e.message))
      .finally(() => setRemovingIp(null));
  }

  function parseDuration(dur: string): number {
    if (!dur.trim()) return 0; // permanent
    const match = dur.match(/^(\d+)\s*([dhms]?)$/i);
    if (!match) return 0;
    const val = parseInt(match[1] ?? "0", 10);
    const unit = (match[2] ?? "d").toLowerCase();
    if (unit === "h") return val * 3600;
    if (unit === "m") return val * 60;
    if (unit === "s") return val;
    return val * 86400; // days
  }

  function handleCreateIpBan() {
    if (!newIp.trim() || !newIpReason.trim()) return;
    api
      .post("/admin/ip-bans", {
        ip: newIp.trim(),
        reason: newIpReason.trim(),
        duration: parseDuration(newIpDuration),
      })
      .then(() => {
        toast("success", "IP banned");
        setShowIpBanModal(false);
        setNewIp("");
        setNewIpReason("");
        setNewIpDuration("");
        fetchIpBans(1);
      })
      .catch((e) => toast("error", e.message));
  }

  function isPermanent(unbanDate: string | null) {
    if (!unbanDate) return true;
    const d = new Date(unbanDate);
    return d.getFullYear() > 9000;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ban Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tab === "account" ? `${total} active account ban${total !== 1 ? "s" : ""}` : `${ipTotal} active IP ban${ipTotal !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {tab === "account" && (
            <div className="relative flex-1 md:flex-none">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full md:w-64 rounded-lg border border-border bg-secondary pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Search bans..."
              />
            </div>
          )}
          {tab === "ip" && (
            <button
              onClick={() => setShowIpBanModal(true)}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
            >
              <Plus className="h-4 w-4" />
              Ban IP
            </button>
          )}
          <button
            onClick={() => tab === "account" ? fetchBans(page) : fetchIpBans(ipPage)}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors shrink-0"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Tab Toggle */}
      <div className="mb-4 flex gap-1 rounded-lg border border-border bg-secondary/50 p-1 self-start">
        <button
          onClick={() => setTab("account")}
          className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            tab === "account" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Ban className="h-3.5 w-3.5" />
          Account Bans
        </button>
        <button
          onClick={() => setTab("ip")}
          className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            tab === "ip" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Globe className="h-3.5 w-3.5" />
          IP Bans
        </button>
      </div>

      {/* Account Bans Tab */}
      {tab === "account" && (
        <>
          {error && (
            <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
          )}

          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : bans.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-border bg-card">
              <div className="text-center">
                <Ban className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                <p className="text-muted-foreground">No active bans.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-card overflow-hidden overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm">
                  <thead className="shrink-0">
                    <tr className="border-b border-border bg-secondary/50">
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Account</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Reason</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Banned By</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Ban Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Expires</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                </table>
                <div className="flex-1 overflow-y-auto">
                  <table className="w-full min-w-[700px] text-sm">
                    <tbody>
                      {bans.map((ban) => (
                        <tr key={ban.id} className="border-b border-border/50 last:border-0 transition-colors hover:bg-secondary/30">
                          <td className="px-4 py-3">
                            <span className="font-medium text-foreground">{ban.username}</span>
                            <span className="ml-2 font-mono text-xs text-muted-foreground">#{ban.accountId}</span>
                          </td>
                          <td className="px-4 py-3 text-foreground max-w-xs truncate">{ban.reason}</td>
                          <td className="px-4 py-3 text-muted-foreground">{ban.bannedBy}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(ban.banDate)}</td>
                          <td className="px-4 py-3">
                            {isPermanent(ban.unbanDate) ? (
                              <span className="inline-block rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">Permanent</span>
                            ) : (
                              <span className="text-muted-foreground">{formatDate(ban.unbanDate)}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleUnban(ban.accountId)}
                              disabled={unbanning === ban.accountId}
                              className="rounded-lg bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
                            >
                              {unbanning === ban.accountId ? "..." : "Unban"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {totalPages > 1 && (
                <div className="mt-3 flex shrink-0 items-center justify-between">
                  <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
                  <div className="flex gap-2">
                    <button onClick={() => fetchBans(page - 1)} disabled={page <= 1} className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-secondary disabled:opacity-30 transition-colors">Previous</button>
                    <button onClick={() => fetchBans(page + 1)} disabled={page >= totalPages} className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-secondary disabled:opacity-30 transition-colors">Next</button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* IP Bans Tab */}
      {tab === "ip" && (
        <>
          {ipError && (
            <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{ipError}</div>
          )}

          {ipLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : ipBans.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-border bg-card">
              <div className="text-center">
                <Globe className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                <p className="text-muted-foreground">No active IP bans.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-card overflow-hidden overflow-x-auto">
                <table className="w-full min-w-[600px] text-sm">
                  <thead className="shrink-0">
                    <tr className="border-b border-border bg-secondary/50">
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">IP Address</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Reason</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Banned By</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Ban Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Expires</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                </table>
                <div className="flex-1 overflow-y-auto">
                  <table className="w-full min-w-[600px] text-sm">
                    <tbody>
                      {ipBans.map((ban) => (
                        <tr key={ban.ip} className="border-b border-border/50 last:border-0 transition-colors hover:bg-secondary/30">
                          <td className="px-4 py-3 font-mono font-medium text-foreground">{ban.ip}</td>
                          <td className="px-4 py-3 text-foreground max-w-xs truncate">{ban.reason}</td>
                          <td className="px-4 py-3 text-muted-foreground">{ban.bannedBy}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(ban.banDate)}</td>
                          <td className="px-4 py-3">
                            {isPermanent(ban.unbanDate) ? (
                              <span className="inline-block rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">Permanent</span>
                            ) : (
                              <span className="text-muted-foreground">{ban.unbanDate ? formatDate(ban.unbanDate) : "Permanent"}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleRemoveIpBan(ban.ip)}
                              disabled={removingIp === ban.ip}
                              className="rounded-lg bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
                            >
                              {removingIp === ban.ip ? "..." : "Unban"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {ipTotalPages > 1 && (
                <div className="mt-3 flex shrink-0 items-center justify-between">
                  <p className="text-sm text-muted-foreground">Page {ipPage} of {ipTotalPages}</p>
                  <div className="flex gap-2">
                    <button onClick={() => fetchIpBans(ipPage - 1)} disabled={ipPage <= 1} className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-secondary disabled:opacity-30 transition-colors">Previous</button>
                    <button onClick={() => fetchIpBans(ipPage + 1)} disabled={ipPage >= ipTotalPages} className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-secondary disabled:opacity-30 transition-colors">Next</button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* IP Ban Modal */}
      {showIpBanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-foreground">Ban IP Address</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">IP Address <span className="text-destructive">*</span></label>
                <input
                  type="text"
                  value={newIp}
                  onChange={(e) => setNewIp(e.target.value)}
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="e.g. 192.168.1.100"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Reason <span className="text-destructive">*</span></label>
                <input
                  type="text"
                  value={newIpReason}
                  onChange={(e) => setNewIpReason(e.target.value)}
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Reason for ban"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Duration</label>
                <input
                  type="text"
                  value={newIpDuration}
                  onChange={(e) => setNewIpDuration(e.target.value)}
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="e.g. 7d, 24h, or leave blank for permanent"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => { setShowIpBanModal(false); setNewIp(""); setNewIpReason(""); setNewIpDuration(""); }}
                className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateIpBan}
                disabled={!newIp.trim() || !newIpReason.trim()}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 transition-colors"
              >
                Ban IP
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
