"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, API_URL } from "@/lib/api";
import { getStoredToken } from "@/lib/auth";
import type { ContainerInfo } from "@repo/shared";

const HISTORY_KEY = "soap-command-history";
const MAX_HISTORY = 50;
const MAX_LINES = 2000;

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

export interface ConsoleLine {
  id: number;
  html: string;
}

let lineIdCounter = 0;

export function useConsole(toHtml: (raw: string) => string) {
  const [containers, setContainers] = useState<ContainerInfo[]>([
    { name: "ac-worldserver", state: "running", status: "" },
    { name: "ac-authserver", state: "running", status: "" },
  ]);
  const [activeContainer, setActiveContainer] = useState("ac-worldserver");
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const [connected, setConnected] = useState(true);
  const [error, setError] = useState("");
  const [command, setCommand] = useState("");
  const [executing, setExecuting] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempt = useRef(0);
  const termRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Command history
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [savedInput, setSavedInput] = useState("");

  const isWorldserver = activeContainer === "ac-worldserver";

  // Load history from localStorage on mount
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

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

  const pushLines = useCallback(
    (...rawLines: string[]) => {
      const newLines: ConsoleLine[] = rawLines.map((raw) => ({
        id: lineIdCounter++,
        html: toHtml(raw),
      }));
      setLines((prev) => {
        const next = [...prev, ...newLines];
        return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
      });
    },
    [toHtml],
  );

  // Connect to SSE stream when active container changes
  useEffect(() => {
    if (!activeContainer) return;
    let disposed = false;

    function cleanup() {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    }

    function connect() {
      if (disposed) return;
      cleanup();
      setError("");
      setAutoScroll(true);

      const token = getStoredToken();
      if (!token) {
        setError("Not authenticated");
        return;
      }

      let cleared = false;
      const url = `${API_URL}/admin/logs/containers/${activeContainer}/stream?token=${encodeURIComponent(token)}&tail=5000`;
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        setConnected(true);
        setError("");
        reconnectAttempt.current = 0;
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
        es.close();
        eventSourceRef.current = null;
        if (disposed) return;
        const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 30_000);
        reconnectAttempt.current++;
        reconnectTimer.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [activeContainer, pushLines]);

  async function handleCommand(e: React.FormEvent) {
    e.preventDefault();
    const cmd = command.trim();
    if (!cmd) return;

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
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;

      if (historyIndex === -1) {
        setSavedInput(command);
      }

      const newIndex =
        historyIndex === -1
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

  return {
    containers,
    activeContainer,
    setActiveContainer,
    lines,
    connected,
    error,
    command,
    setCommand,
    executing,
    autoScroll,
    setAutoScroll,
    termRef,
    inputRef,
    isWorldserver,
    historyIndex,
    setHistoryIndex,
    handleScroll,
    handleCommand,
    handleKeyDown,
    clearTerminal,
  };
}
