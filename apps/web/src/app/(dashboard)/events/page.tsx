"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { Activity, Search, Clock } from "lucide-react";

interface ServerEvent {
  id: number;
  timestamp: string;
  container: string;
  event_type: string;
  details: string | null;
  duration_ms: number | null;
}

interface EventsApiResponse {
  data: ServerEvent[];
  total: number;
  page: number;
  limit: number;
}

const LIMIT = 25;

function formatRelativeTime(timestamp: string): string {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function formatTimestamp(timestamp: string): string {
  const d = new Date(timestamp);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function shortenContainer(c: string): string {
  if (c.includes("worldserver")) return "Worldserver";
  if (c.includes("authserver")) return "Authserver";
  return c;
}

function eventTypeBadge(t: string) {
  const styles: Record<string, string> = {
    crash: "bg-red-500/10 text-red-400",
    restart_failed: "bg-red-500/10 text-red-400",
    crash_loop: "bg-red-500/10 text-red-400 animate-pulse",
    restart_attempt: "bg-yellow-500/10 text-yellow-400",
    restart_success: "bg-emerald-500/10 text-emerald-400",
    recovery: "bg-emerald-500/10 text-emerald-400",
    soap_degraded: "bg-yellow-500/10 text-yellow-400",
    soap_recovered: "bg-emerald-500/10 text-emerald-400",
  };
  return styles[t] ?? "bg-secondary text-muted-foreground";
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

export default function EventsPage() {
  const [events, setEvents] = useState<ServerEvent[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [container, setContainer] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const fetchEvents = useCallback(
    (p: number) => {
      setLoading(true);
      setError("");
      let url = `/server/events?page=${p}&limit=${LIMIT}`;
      if (container) url += `&container=${encodeURIComponent(container)}`;
      api
        .get<EventsApiResponse>(url)
        .then((res) => {
          setEvents(res.data);
          setTotal(res.total);
          setPage(res.page);
          setTotalPages(Math.ceil(res.total / LIMIT));
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    },
    [container],
  );

  useEffect(() => {
    fetchEvents(1);
  }, [fetchEvents]);

  // Filter by search client-side (event_type or details)
  const filtered = debouncedSearch
    ? events.filter(
        (e) =>
          e.event_type.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          (e.details?.toLowerCase().includes(debouncedSearch.toLowerCase()) ?? false) ||
          shortenContainer(e.container).toLowerCase().includes(debouncedSearch.toLowerCase()),
      )
    : events;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Event History</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} total event{total !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 md:flex-none">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="w-full md:w-56 rounded-lg border border-border bg-secondary pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Filter events..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          <select
            value={container}
            onChange={(e) => setContainer(e.target.value)}
            className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All containers</option>
            <option value="ac-worldserver">Worldserver</option>
            <option value="ac-authserver">Authserver</option>
          </select>
          <button
            onClick={() => fetchEvents(page)}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors shrink-0"
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
      ) : filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-border bg-card">
          <div className="text-center">
            <Activity className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-muted-foreground">No events recorded</p>
          </div>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-card overflow-hidden overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="shrink-0">
                <tr className="border-b border-border bg-secondary/50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground w-40">
                    Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground w-28">
                    Container
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground w-36">
                    Event
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Details
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground w-24">
                    Duration
                  </th>
                </tr>
              </thead>
            </table>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full min-w-[600px] text-sm">
                <tbody>
                  {filtered.map((event) => (
                    <tr
                      key={event.id}
                      className="border-b border-border/50 last:border-0 transition-colors hover:bg-secondary/30"
                    >
                      <td className="px-4 py-3 w-40">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span title={formatTimestamp(event.timestamp)}>
                            {formatRelativeTime(event.timestamp)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 w-28">
                        <span className="rounded bg-secondary px-2 py-0.5 text-xs font-medium text-foreground">
                          {shortenContainer(event.container)}
                        </span>
                      </td>
                      <td className="px-4 py-3 w-36">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${eventTypeBadge(event.event_type)}`}
                        >
                          {event.event_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground truncate max-w-xs">
                        {event.details || "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {event.duration_ms != null
                          ? formatDuration(event.duration_ms)
                          : "—"}
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
                  onClick={() => fetchEvents(page - 1)}
                  disabled={page <= 1}
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-secondary disabled:opacity-30 transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => fetchEvents(page + 1)}
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
