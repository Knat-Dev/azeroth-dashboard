"use client";

import { api, API_URL } from "@/lib/api";
import { getStoredToken } from "@/lib/auth";
import Convert from "ansi-to-html";
import { memo, useCallback, useEffect, useRef, useState } from "react";

const convert = new Convert({
  fg: "#d4d4d4",
  bg: "transparent",
  newline: false,
  escapeXML: true,
  colors: {
    0: "#1e1e1e",
    1: "#f44747",
    2: "#6a9955",
    3: "#d7ba7d",
    4: "#569cd6",
    5: "#c586c0",
    6: "#4ec9b0",
    7: "#d4d4d4",
    8: "#808080",
    9: "#f44747",
    10: "#6a9955",
    11: "#d7ba7d",
    12: "#569cd6",
    13: "#c586c0",
    14: "#4ec9b0",
    15: "#ffffff",
  },
});

function toHtml(raw: string): string {
  return convert.toHtml(raw);
}

interface ContainerInfo {
  name: string;
  state: string;
  status: string;
}

const CONTAINER_LABELS: Record<string, string> = {
  "ac-worldserver": "Worldserver",
  "ac-authserver": "Authserver",
};

const HISTORY_KEY = "soap-command-history";
const MAX_HISTORY = 50;

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(history: string[]) {
  localStorage.setItem(
    HISTORY_KEY,
    JSON.stringify(history.slice(-MAX_HISTORY)),
  );
}

interface Line {
  id: number;
  html: string;
}

const LogLine = memo(function LogLine({ html }: { html: string }) {
  return (
    <div
      className="whitespace-pre-wrap break-all text-[#d4d4d4]"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

let lineIdCounter = 0;

export default function ConsolePage() {
  const [containers, setContainers] = useState<ContainerInfo[]>([
    { name: "ac-worldserver", state: "running", status: "" },
    { name: "ac-authserver", state: "running", status: "" },
  ]);
  const [activeContainer, setActiveContainer] = useState("ac-worldserver");
  const [lines, setLines] = useState<Line[]>([]);
  const [connected, setConnected] = useState(true);
  const [error, setError] = useState("");
  const [command, setCommand] = useState("");
  const [executing, setExecuting] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);
  const termRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const maxLines = 2000;

  // Command history
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [savedInput, setSavedInput] = useState("");

  // Load history from localStorage on mount
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const isWorldserver = activeContainer === "ac-worldserver";

  // Fetch real container states in background
  useEffect(() => {
    api
      .get<ContainerInfo[]>("/admin/logs/containers")
      .then((res) => {
        if (res.length > 0) setContainers(res);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (autoScroll && termRef.current) {
      termRef.current.scrollTop = 0;
    }
  }, [lines, autoScroll]);

  function handleScroll() {
    if (!termRef.current) return;
    const atBottom = termRef.current.scrollTop >= -40;
    setAutoScroll(atBottom);
  }

  const pushLines = useCallback((...rawLines: string[]) => {
    const newLines: Line[] = rawLines.map((raw) => ({
      id: lineIdCounter++,
      html: toHtml(raw),
    }));
    setLines((prev) => {
      const next = [...prev, ...newLines];
      return next.length > maxLines ? next.slice(-maxLines) : next;
    });
  }, []);

  // Connect to SSE stream when active container changes
  useEffect(() => {
    if (!activeContainer) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setError("");
    let cleared = false;

    const token = getStoredToken();
    if (!token) {
      setError("Not authenticated");
      return;
    }

    const url = `${API_URL}/admin/logs/containers/${activeContainer}/stream?token=${encodeURIComponent(token)}&tail=5000`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
      setError("");
    };

    es.onmessage = (event) => {
      if (!cleared) {
        setLines([]);
        cleared = true;
      }
      try {
        const line = JSON.parse(event.data);
        if (typeof line === "string") {
          pushLines(line);
        } else if (line?.error) {
          setError(line.error);
        }
      } catch {
        pushLines(event.data);
      }
    };

    es.addEventListener("end", () => {
      setConnected(false);
    });

    es.onerror = () => {
      setConnected(false);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [activeContainer, pushLines]);

  async function handleCommand(e: React.FormEvent) {
    e.preventDefault();
    const cmd = command.trim();
    if (!cmd) return;

    // Push to history
    const newHistory = [...history.filter((h) => h !== cmd), cmd];
    setHistory(newHistory);
    saveHistory(newHistory);
    setHistoryIndex(-1);
    setSavedInput("");

    setExecuting(true);
    try {
      const res = await api.post<{ success: boolean; message: string }>(
        "/admin/command",
        { command: cmd },
      );
      const prefix = res.success ? "\x1b[32m" : "\x1b[31m";
      const reset = "\x1b[0m";
      pushLines(`${prefix}> ${cmd}${reset}`, `${prefix}${res.message}${reset}`);
      setCommand("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Command failed";
      pushLines(`\x1b[31m> ${cmd}\x1b[0m`, `\x1b[31m${msg}\x1b[0m`);
    } finally {
      setExecuting(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;

      if (historyIndex === -1) {
        setSavedInput(command);
      }

      const newIndex = historyIndex === -1
        ? history.length - 1
        : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIndex);
      setCommand(history[newIndex] ?? "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex === -1) return;

      if (historyIndex >= history.length - 1) {
        setHistoryIndex(-1);
        setCommand(savedInput);
      } else {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setCommand(history[newIndex] ?? "");
      }
    }
  }

  function clearTerminal() {
    setLines([]);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Server Console
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live container logs &amp; SOAP commands
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`h-2.5 w-2.5 rounded-full ${
                connected
                  ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]"
                  : "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]"
              }`}
            />
            <span className="text-xs text-muted-foreground">
              {connected ? "Connected" : "Disconnected"}
            </span>
          </div>
          <button
            onClick={clearTerminal}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Container tabs */}
      <div className="ml-3 flex gap-1">
        {containers.map((c) => (
          <button
            key={c.name}
            onClick={() => setActiveContainer(c.name)}
            className={`flex cursor-pointer items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeContainer === c.name
                ? "bg-[#1a1b26] text-foreground border border-b-0 border-border"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            <div
              className={`h-2 w-2 rounded-full ${
                c.state === "running" ? "bg-green-500" : "bg-red-500"
              }`}
            />
            {CONTAINER_LABELS[c.name] ?? c.name}
          </button>
        ))}
        {containers.length === 0 && !error && (
          <span className="px-4 py-2 text-sm text-muted-foreground">
            Loading containers...
          </span>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-3 rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Terminal */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-[#1a1b26]">
        {/* Terminal header bar */}
        <div className="flex items-center justify-between border-b border-border/50 bg-[#13141c] px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <div className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <div className="h-3 w-3 rounded-full bg-[#28c840]" />
            </div>
            <span className="ml-3 font-mono text-xs text-muted-foreground">
              {activeContainer || "no container selected"}
            </span>
          </div>
          <button
            onClick={() => {
              setAutoScroll(!autoScroll);
              if (!autoScroll && termRef.current) {
                termRef.current.scrollTop = 0;
              }
            }}
            className={`rounded px-2 py-0.5 font-mono text-xs transition-colors ${
              autoScroll
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {autoScroll ? "AUTO-SCROLL ON" : "AUTO-SCROLL OFF"}
          </button>
        </div>

        {/* Log output */}
        <div
          ref={termRef}
          onScroll={handleScroll}
          className="flex flex-1 flex-col-reverse overflow-y-auto overflow-x-hidden p-4 font-mono text-[13px] leading-[1.6]"
        >
          {lines.length === 0 && !connected && !error ? (
            <div className="text-muted-foreground">
              {activeContainer
                ? "Connecting to container..."
                : "Select a container above to view logs."}
            </div>
          ) : (
            [...lines].reverse().map((line) => (
              <LogLine key={line.id} html={line.html} />
            ))
          )}
        </div>

        {/* Command input — only for worldserver */}
        {isWorldserver ? (
          <form
            onSubmit={handleCommand}
            className="flex items-center gap-2 border-t border-border/50 bg-[#13141c] px-4 py-2.5"
          >
            <span className="font-mono text-sm text-primary">$</span>
            <input
              ref={inputRef}
              type="text"
              value={command}
              onChange={(e) => {
                setCommand(e.target.value);
                setHistoryIndex(-1);
              }}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent font-mono text-sm text-[#d4d4d4] placeholder:text-muted-foreground/50 focus:outline-none"
              placeholder="Type a SOAP command (e.g. .server info) — ↑↓ for history"
              disabled={executing}
            />
            <button
              type="submit"
              disabled={executing || !command.trim()}
              className="rounded bg-primary/20 px-3 py-1 font-mono text-xs text-primary hover:bg-primary/30 disabled:opacity-30 transition-colors"
            >
              {executing ? "..." : "Send"}
            </button>
          </form>
        ) : (
          <div className="border-t border-border/50 bg-[#13141c] px-4 py-2.5">
            <span className="font-mono text-xs text-muted-foreground/50">
              SOAP commands are only available on the Worldserver tab
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
