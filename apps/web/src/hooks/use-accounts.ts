"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/providers/toast-provider";
import type { AccountListItem, PaginatedResponse } from "@repo/shared";

const LIMIT = 20;

export function useAccounts() {
  const [accounts, setAccounts] = useState<AccountListItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search state
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const abortRef = useRef<AbortController | null>(null);

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
  const { toast } = useToast();

  const fetchAccounts = useCallback(
    (p: number, searchTerm?: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError("");
      const term = searchTerm !== undefined ? searchTerm : debouncedSearch;
      let url = `/admin/accounts?page=${p}&limit=${LIMIT}`;
      if (term) {
        url += `&search=${encodeURIComponent(term)}`;
      }
      api
        .get<PaginatedResponse<AccountListItem>>(url, { signal: controller.signal })
        .then((res) => {
          setAccounts(res.data);
          setTotal(res.total);
          setPage(res.page);
          setTotalPages(Math.ceil(res.total / LIMIT));
        })
        .catch((e) => {
          if (e instanceof DOMException && e.name === "AbortError") return;
          setError(e.message);
        })
        .finally(() => setLoading(false));
    },
    [debouncedSearch],
  );

  useEffect(() => {
    fetchAccounts(1);
  }, [fetchAccounts]);

  useEffect(() => {
    fetchAccounts(1, debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

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
        toast("success", "Account banned");
        fetchAccounts(page);
      })
      .catch((e) => toast("error", e.message));
  }

  function openCreateModal() {
    setCreateUsername("");
    setCreatePassword("");
    setCreateEmail("");
    setCreateGmLevel(0);
    setCreateError("");
    setShowCreateModal(true);
  }

  function closeCreateModal() {
    setShowCreateModal(false);
    setCreateUsername("");
    setCreatePassword("");
    setCreateEmail("");
    setCreateGmLevel(0);
    setCreateError("");
    setCreateLoading(false);
  }

  function handleCreate() {
    if (!createUsername.trim() || !createPassword.trim()) return;
    setCreateLoading(true);
    setCreateError("");
    api
      .post("/admin/accounts", {
        username: createUsername,
        password: createPassword,
        email: createEmail || undefined,
        gmLevel: createGmLevel,
      })
      .then(() => {
        closeCreateModal();
        toast("success", "Account created successfully");
        fetchAccounts(1);
      })
      .catch((e) => {
        setCreateError(e.message);
        setCreateLoading(false);
      });
  }

  return {
    // List state
    accounts,
    page,
    totalPages,
    total,
    loading,
    error,
    search,
    setSearch,
    fetchAccounts,

    // Ban modal
    showBanModal,
    banningId,
    banReason,
    setBanReason,
    banDuration,
    setBanDuration,
    openBanModal,
    closeBanModal,
    handleBan,

    // Create modal
    showCreateModal,
    createUsername,
    setCreateUsername,
    createPassword,
    setCreatePassword,
    createEmail,
    setCreateEmail,
    createGmLevel,
    setCreateGmLevel,
    createLoading,
    createError,
    openCreateModal,
    closeCreateModal,
    handleCreate,
  };
}
