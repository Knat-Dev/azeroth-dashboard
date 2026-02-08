"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatGold, formatPlaytime } from "@/lib/utils";
import type { OnlinePlayer, PaginatedResponse } from "@repo/shared";
import {
  getClassName,
  getClassColor,
  getRaceName,
  getZoneName,
  getFaction,
} from "@/lib/wow-constants";
import { Users, RefreshCw, Search } from "lucide-react";

const LIMIT = 20;
const REFRESH_INTERVAL = 30;

export default function PlayersPage() {
  const [players, setPlayers] = useState<OnlinePlayer[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const lastFetchedAt = useRef<number>(Date.now());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const fetchPlayers = useCallback(
    (p: number, manual = false, searchTerm?: string) => {
      if (manual) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");
      const term = searchTerm !== undefined ? searchTerm : debouncedSearch;
      let url = `/server/players?page=${p}&limit=${LIMIT}`;
      if (term) {
        url += `&search=${encodeURIComponent(term)}`;
      }
      api
        .get<PaginatedResponse<OnlinePlayer>>(url)
        .then((res) => {
          setPlayers(res.data);
          setTotal(res.total);
          setPage(res.page);
          setTotalPages(Math.ceil(res.total / LIMIT));
          lastFetchedAt.current = Date.now();
          setSecondsAgo(0);
        })
        .catch((e) => setError(e.message))
        .finally(() => {
          setLoading(false);
          setRefreshing(false);
        });
    },
    [debouncedSearch],
  );

  useEffect(() => {
    fetchPlayers(1);
  }, [fetchPlayers]);

  // Reset to page 1 on search change
  useEffect(() => {
    fetchPlayers(1, false, debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPlayers(page);
    }, REFRESH_INTERVAL * 1000);
    return () => clearInterval(interval);
  }, [fetchPlayers, page]);

  // Update "seconds ago" counter every second
  useEffect(() => {
    const ticker = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastFetchedAt.current) / 1000));
    }, 1000);
    return () => clearInterval(ticker);
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Header — shrinks */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Online Players</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} player{total !== 1 ? "s" : ""} online
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 md:flex-none">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="w-full md:w-64 rounded-lg border border-border bg-secondary pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Search players..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            Last updated: {secondsAgo}s ago
          </span>
          <button
            onClick={() => fetchPlayers(page, true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground hover:bg-secondary disabled:opacity-50 transition-colors shrink-0"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
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
          <p className="ml-3 text-sm text-muted-foreground">
            Loading players...
          </p>
        </div>
      ) : players.length === 0 && !error ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-border bg-card">
          <div className="text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-muted-foreground">No players online</p>
          </div>
        </div>
      ) : (
        <>
          {/* Table — flex-1, only tbody scrolls */}
          <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-card overflow-hidden overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="shrink-0">
                <tr className="border-b border-border bg-secondary/50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Level
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Class
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Race
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Faction
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Guild
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Gold
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Play Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Zone
                  </th>
                </tr>
              </thead>
            </table>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full min-w-[900px] text-sm">
                <tbody>
                  {players.map((player) => {
                    const faction = getFaction(player.race);
                    return (
                      <tr
                        key={player.guid}
                        className="border-b border-border/50 last:border-0 text-sm text-foreground hover:bg-secondary/30 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium">
                          <Link
                            href={`/players/${player.guid}`}
                            className="text-primary hover:underline"
                          >
                            {player.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3">{player.level}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{
                                backgroundColor: getClassColor(player.class),
                              }}
                            />
                            <span
                              style={{ color: getClassColor(player.class) }}
                            >
                              {getClassName(player.class)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">{getRaceName(player.race)}</td>
                        <td className="px-4 py-3">
                          {faction === "Alliance" ? (
                            <span className="inline-block rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-400">
                              Alliance
                            </span>
                          ) : faction === "Horde" ? (
                            <span className="inline-block rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">
                              Horde
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Unknown</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {player.guildName || "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {player.money != null ? formatGold(player.money) : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {player.totaltime != null ? formatPlaytime(player.totaltime) : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {getZoneName(player.zone)}
                        </td>
                      </tr>
                    );
                  })}
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
                  onClick={() => fetchPlayers(page - 1)}
                  disabled={page <= 1}
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-secondary disabled:opacity-30 transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => fetchPlayers(page + 1)}
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
