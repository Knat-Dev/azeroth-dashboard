"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { UserCog, Plus, Search } from "lucide-react";

interface Account {
  id: number;
  username: string;
  email: string;
  gmLevel: number;
  lastLogin: string;
}

interface AccountsApiResponse {
  data: Account[];
  total: number;
  page: number;
  limit: number;
}

const LIMIT = 20;

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ban modal state
  const [banningId, setBanningId] = useState<number | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banDuration, setBanDuration] = useState("");
  const [showBanModal, setShowBanModal] = useState(false);

  // Create account modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createUsername, setCreateUsername] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createGmLevel, setCreateGmLevel] = useState(0);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");

  const fetchAccounts = useCallback(
    (p: number, searchTerm?: string) => {
      setLoading(true);
      setError("");
      const term = searchTerm !== undefined ? searchTerm : debouncedSearch;
      let url = `/admin/accounts?page=${p}&limit=${LIMIT}`;
      if (term) {
        url += `&search=${encodeURIComponent(term)}`;
      }
      api
        .get<AccountsApiResponse>(url)
        .then((res) => {
          setAccounts(res.data);
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
    fetchAccounts(1);
  }, [fetchAccounts]);

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
    fetchAccounts(1, debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // Ban modal handlers
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

  // Create account modal handlers
  function openCreateModal() {
    setCreateUsername("");
    setCreatePassword("");
    setCreateEmail("");
    setCreateGmLevel(0);
    setCreateError("");
    setCreateSuccess("");
    setShowCreateModal(true);
  }

  function closeCreateModal() {
    setShowCreateModal(false);
    setCreateUsername("");
    setCreatePassword("");
    setCreateEmail("");
    setCreateGmLevel(0);
    setCreateError("");
    setCreateSuccess("");
    setCreateLoading(false);
  }

  function handleCreate() {
    if (!createUsername.trim() || !createPassword.trim()) return;
    setCreateLoading(true);
    setCreateError("");
    setCreateSuccess("");
    api
      .post("/admin/accounts", {
        username: createUsername,
        password: createPassword,
        email: createEmail || undefined,
        gmLevel: createGmLevel,
      })
      .then(() => {
        setCreateSuccess("Account created successfully.");
        fetchAccounts(1);
        setTimeout(() => {
          closeCreateModal();
        }, 1000);
      })
      .catch((e) => {
        setCreateError(e.message);
        setCreateLoading(false);
      });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header — shrinks */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Account Management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} total accounts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-64 rounded-lg border border-border bg-secondary py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Search accounts..."
            />
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Account
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
      ) : accounts.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-border bg-card">
          <div className="text-center">
            <UserCog className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-muted-foreground">No accounts found.</p>
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
                    ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Username
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    GM Level
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Last Login
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
                  {accounts.map((account) => (
                    <tr
                      key={account.id}
                      className="border-b border-border/50 last:border-0 transition-colors hover:bg-secondary/30"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
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
                          <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                            GM {account.gmLevel}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Player</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(account.lastLogin, "Never")}
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
                  onClick={() => fetchAccounts(page - 1)}
                  disabled={page <= 1}
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-secondary disabled:opacity-30 transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => fetchAccounts(page + 1)}
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

      {/* Ban Modal */}
      {showBanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
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
                  autoFocus
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
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 transition-colors"
              >
                Confirm Ban
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Account Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-semibold text-foreground">
              Create Account
            </h3>

            {createSuccess && (
              <div className="mb-4 rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
                {createSuccess}
              </div>
            )}

            {createError && (
              <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {createError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Username <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={createUsername}
                  onChange={(e) => setCreateUsername(e.target.value)}
                  maxLength={16}
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter username"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Password <span className="text-destructive">*</span>
                </label>
                <input
                  type="password"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  maxLength={16}
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter password"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Email
                </label>
                <input
                  type="email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter email (optional)"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  GM Level
                </label>
                <select
                  value={createGmLevel}
                  onChange={(e) => setCreateGmLevel(Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value={0}>0 - Player</option>
                  <option value={1}>1 - GM</option>
                  <option value={2}>2 - Moderator</option>
                  <option value={3}>3 - Administrator</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={closeCreateModal}
                className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={
                  !createUsername.trim() || !createPassword.trim() || createLoading
                }
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {createLoading ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
