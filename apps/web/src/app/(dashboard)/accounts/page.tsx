"use client";

import { useAccounts } from "@/hooks/use-accounts";
import { formatDate } from "@/lib/utils";
import { UserCog, Plus, Search, KeyRound } from "lucide-react";

export default function AccountsPage() {
  const {
    accounts, page, totalPages, total, loading, error, search, setSearch, fetchAccounts,
    showBanModal, banningId, banReason, setBanReason, banDuration, setBanDuration,
    openBanModal, closeBanModal, handleBan,
    showResetModal, resetId, resetPassword, setResetPasswordVal, resetConfirm, setResetConfirm,
    resetLoading, resetError, openResetModal, closeResetModal, handleResetPassword,
    showCreateModal, createUsername, setCreateUsername, createPassword, setCreatePassword,
    createEmail, setCreateEmail, createGmLevel, setCreateGmLevel, createLoading,
    createError, openCreateModal, closeCreateModal, handleCreate,
  } = useAccounts();

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Account Management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} total accounts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 md:flex-none">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full md:w-64 rounded-lg border border-border bg-secondary py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Search accounts..."
            />
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
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
          {/* Table */}
          <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-card overflow-hidden overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="shrink-0">
                <tr className="border-b border-border bg-secondary/50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Username</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">GM Level</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Last Login</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</th>
                </tr>
              </thead>
            </table>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full min-w-[700px] text-sm">
                <tbody>
                  {accounts.map((account) => (
                    <tr
                      key={account.id}
                      className="border-b border-border/50 last:border-0 transition-colors hover:bg-secondary/30"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{account.id}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{account.username}</td>
                      <td className="px-4 py-3 text-muted-foreground">{account.email || "-"}</td>
                      <td className="px-4 py-3">
                        {account.gmLevel > 0 ? (
                          <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                            GM {account.gmLevel}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Player</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(account.lastLogin, "Never")}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openResetModal(account.id)}
                            className="rounded-lg bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                          >
                            <KeyRound className="inline h-3 w-3 mr-1" />
                            Reset PW
                          </button>
                          <button
                            onClick={() => openBanModal(account.id)}
                            className="rounded-lg bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors"
                          >
                            Ban
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
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
          <div className="mx-4 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-foreground">
              Ban Account #{banningId}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Reason</label>
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

      {/* Reset Password Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-foreground">
              Reset Password — Account #{resetId}
            </h3>

            {resetError && (
              <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {resetError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  New Password <span className="text-destructive">*</span>
                </label>
                <input
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPasswordVal(e.target.value)}
                  maxLength={16}
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter new password"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Confirm Password <span className="text-destructive">*</span>
                </label>
                <input
                  type="password"
                  value={resetConfirm}
                  onChange={(e) => setResetConfirm(e.target.value)}
                  maxLength={16}
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Confirm new password"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Password must be between 6 and 16 characters
              </p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={closeResetModal}
                className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                disabled={!resetPassword.trim() || !resetConfirm.trim() || resetLoading}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {resetLoading ? "Resetting..." : "Reset Password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Account Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-foreground">Create Account</h3>

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
                <label className="mb-1 block text-sm font-medium text-foreground">Email</label>
                <input
                  type="email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter email (optional)"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">GM Level</label>
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
                disabled={!createUsername.trim() || !createPassword.trim() || createLoading}
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
