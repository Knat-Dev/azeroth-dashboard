"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Ban, Search } from "lucide-react";

interface BanEntry {
  id: number;
  accountId: number;
  username: string;
  reason: string;
  bannedBy: string;
  banDate: string;
  unbanDate: string;
}

interface BansApiResponse {
  data: BanEntry[];
  total: number;
  page: number;
  limit: number;
}

const LIMIT = 20;

export default function BansPage() {
  const [bans, setBans] = useState<BanEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unbanning, setUnbanning] = useState<number | null>(null);

  // Search state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        .get<BansApiResponse>(url)
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

  useEffect(() => {
    fetchBans(1);
  }, [fetchBans]);

  // Debounce search input
  function handleSearchChange(value: string) {
    setSearch(value);
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
  }

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  // When debounced search changes, reset to page 1 and fetch
  useEffect(() => {
    fetchBans(1, debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  function handleUnban(accountId: number) {
    setUnbanning(accountId);
    setError("");
    api
      .delete(`/admin/accounts/${accountId}/ban`)
      .then(() => {
        fetchBans(page);
      })
      .catch((e) => setError(e.message))
      .finally(() => setUnbanning(null));
  }

  function isPermanent(unbanDate: string) {
    if (!unbanDate) return true;
    const d = new Date(unbanDate);
    return d.getFullYear() > 9000;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header — shrinks */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ban Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} active ban{total !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-64 rounded-lg border border-border bg-secondary pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Search bans..."
            />
          </div>
          <button
            onClick={() => fetchBans(page)}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
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
          {/* Table — flex-1, only tbody scrolls */}
          <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="shrink-0">
                <tr className="border-b border-border bg-secondary/50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Account
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Reason
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Banned By
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Ban Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Expires
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
            </table>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-sm">
                <tbody>
                  {bans.map((ban) => (
                    <tr
                      key={ban.id}
                      className="border-b border-border/50 last:border-0 transition-colors hover:bg-secondary/30"
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">
                          {ban.username}
                        </span>
                        <span className="ml-2 font-mono text-xs text-muted-foreground">
                          #{ban.accountId}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground max-w-xs truncate">
                        {ban.reason}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {ban.bannedBy}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(ban.banDate)}
                      </td>
                      <td className="px-4 py-3">
                        {isPermanent(ban.unbanDate) ? (
                          <span className="inline-block rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
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
                          {unbanning === ban.accountId ? "..." : "Unban"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination — shrinks */}
          {totalPages > 1 && (
            <div className="mt-3 flex shrink-0 items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchBans(page - 1)}
                  disabled={page <= 1}
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-secondary disabled:opacity-30 transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => fetchBans(page + 1)}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-secondary disabled:opacity-30 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
