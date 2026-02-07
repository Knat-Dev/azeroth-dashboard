"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

type Tab = "db" | "ip" | "server";

interface LogEntry {
  id: number;
  time: string;
  type: number;
  level: number;
  string: string;
}

interface IpAction {
  id: number;
  accountId: number;
  username: string;
  ip: string;
  action: string;
  time: string;
}

interface PaginatedLogs<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}

export default function LogsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("db");

  const [dbLogs, setDbLogs] = useState<LogEntry[]>([]);
  const [dbPage, setDbPage] = useState(1);
  const [dbTotalPages, setDbTotalPages] = useState(1);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState("");

  const [ipActions, setIpActions] = useState<IpAction[]>([]);
  const [ipPage, setIpPage] = useState(1);
  const [ipTotalPages, setIpTotalPages] = useState(1);
  const [ipLoading, setIpLoading] = useState(false);
  const [ipError, setIpError] = useState("");

  const [serverLog, setServerLog] = useState("");
  const [serverLoading, setServerLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const fetchDbLogs = useCallback((p: number) => {
    setDbLoading(true);
    setDbError("");
    api
      .get<PaginatedLogs<LogEntry>>(`/admin/logs?page=${p}`)
      .then((res) => {
        setDbLogs(res.data);
        setDbPage(res.page);
        setDbTotalPages(res.totalPages);
      })
      .catch((e) => setDbError(e.message))
      .finally(() => setDbLoading(false));
  }, []);

  const fetchIpActions = useCallback((p: number) => {
    setIpLoading(true);
    setIpError("");
    api
      .get<PaginatedLogs<IpAction>>(`/admin/logs/ip-actions?page=${p}`)
      .then((res) => {
        setIpActions(res.data);
        setIpPage(res.page);
        setIpTotalPages(res.totalPages);
      })
      .catch((e) => setIpError(e.message))
      .finally(() => setIpLoading(false));
  }, []);

  const fetchServerLog = useCallback(() => {
    setServerLoading(true);
    setServerError("");
    api
      .get<{ content: string }>(`/admin/logs/files?file=Server.log&lines=200`)
      .then((res) => setServerLog(res.content))
      .catch((e) => setServerError(e.message))
      .finally(() => setServerLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === "db") fetchDbLogs(dbPage);
    else if (activeTab === "ip") fetchIpActions(ipPage);
    else if (activeTab === "server") fetchServerLog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  function formatDate(dateStr: string) {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "db", label: "DB Logs" },
    { key: "ip", label: "IP Actions" },
    { key: "server", label: "Server Log" },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">Logs</h1>

      {/* Tab Bar */}
      <div className="mb-6 flex gap-1 rounded-lg border border-border bg-card p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* DB Logs Tab */}
      {activeTab === "db" && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {dbPage} of {dbTotalPages}
            </p>
            <button
              onClick={() => fetchDbLogs(dbPage)}
              className="rounded-lg border border-border bg-card px-4 py-1.5 text-sm text-foreground hover:bg-secondary transition-colors"
            >
              Refresh
            </button>
          </div>

          {dbError && (
            <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {dbError}
            </div>
          )}

          {dbLoading ? (
            <div className="text-muted-foreground">Loading logs...</div>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Time
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Level
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Message
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dbLogs.map((log) => (
                      <tr
                        key={log.id}
                        className="border-b border-border last:border-0"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {formatDate(log.time)}
                        </td>
                        <td className="px-4 py-3 font-mono text-foreground">
                          {log.type}
                        </td>
                        <td className="px-4 py-3 font-mono text-foreground">
                          {log.level}
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          <span className="line-clamp-2">{log.string}</span>
                        </td>
                      </tr>
                    ))}
                    {dbLogs.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-8 text-center text-muted-foreground"
                        >
                          No log entries found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => fetchDbLogs(dbPage - 1)}
                  disabled={dbPage <= 1}
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-secondary disabled:opacity-50 transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => fetchDbLogs(dbPage + 1)}
                  disabled={dbPage >= dbTotalPages}
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-secondary disabled:opacity-50 transition-colors"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* IP Actions Tab */}
      {activeTab === "ip" && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {ipPage} of {ipTotalPages}
            </p>
            <button
              onClick={() => fetchIpActions(ipPage)}
              className="rounded-lg border border-border bg-card px-4 py-1.5 text-sm text-foreground hover:bg-secondary transition-colors"
            >
              Refresh
            </button>
          </div>

          {ipError && (
            <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {ipError}
            </div>
          )}

          {ipLoading ? (
            <div className="text-muted-foreground">
              Loading IP actions...
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Time
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Account
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        IP
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ipActions.map((entry) => (
                      <tr
                        key={entry.id}
                        className="border-b border-border last:border-0"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {formatDate(entry.time)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-foreground">
                            {entry.username}
                          </span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            #{entry.accountId}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-foreground">
                          {entry.ip}
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          {entry.action}
                        </td>
                      </tr>
                    ))}
                    {ipActions.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-8 text-center text-muted-foreground"
                        >
                          No IP actions found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => fetchIpActions(ipPage - 1)}
                  disabled={ipPage <= 1}
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-secondary disabled:opacity-50 transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => fetchIpActions(ipPage + 1)}
                  disabled={ipPage >= ipTotalPages}
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-secondary disabled:opacity-50 transition-colors"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Server Log Tab */}
      {activeTab === "server" && (
        <div>
          <div className="mb-4 flex items-center justify-end">
            <button
              onClick={fetchServerLog}
              className="rounded-lg border border-border bg-card px-4 py-1.5 text-sm text-foreground hover:bg-secondary transition-colors"
            >
              Refresh
            </button>
          </div>

          {serverError && (
            <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {serverError}
            </div>
          )}

          {serverLoading ? (
            <div className="text-muted-foreground">
              Loading server log...
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="border-b border-border bg-secondary px-4 py-2.5">
                <span className="text-sm font-medium text-muted-foreground">
                  Server.log (last 200 lines)
                </span>
              </div>
              <pre className="max-h-[600px] overflow-auto p-4 font-mono text-xs text-foreground">
                {serverLog || "No log content available."}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
