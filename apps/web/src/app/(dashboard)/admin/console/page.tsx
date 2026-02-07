"use client";

import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";

interface CommandResult {
  command: string;
  success: boolean;
  message: string;
  timestamp: Date;
}

export default function ConsolePage() {
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<CommandResult[]>([]);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState("");
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [history]);

  async function handleExecute(e: React.FormEvent) {
    e.preventDefault();
    const cmd = command.trim();
    if (!cmd) return;

    setExecuting(true);
    setError("");

    try {
      const res = await api.post<{ success: boolean; message: string }>(
        "/admin/command",
        { command: cmd },
      );
      setHistory((prev) => [
        ...prev,
        {
          command: cmd,
          success: res.success,
          message: res.message,
          timestamp: new Date(),
        },
      ]);
      setCommand("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Command execution failed";
      setError(msg);
      setHistory((prev) => [
        ...prev,
        {
          command: cmd,
          success: false,
          message: msg,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setExecuting(false);
    }
  }

  function formatTime(d: Date) {
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function clearHistory() {
    setHistory([]);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">SOAP Console</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Execute server commands via SOAP
          </p>
        </div>
        {history.length > 0 && (
          <button
            onClick={clearHistory}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
          >
            Clear History
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleExecute} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-secondary px-4 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Enter server command (e.g. .server info)"
            disabled={executing}
          />
          <button
            type="submit"
            disabled={executing || !command.trim()}
            className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {executing ? "Executing..." : "Execute"}
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border bg-secondary px-4 py-2.5">
          <h2 className="text-sm font-medium text-muted-foreground">
            Command History
          </h2>
        </div>
        <div
          ref={outputRef}
          className="max-h-[500px] overflow-y-auto p-4 font-mono text-sm"
        >
          {history.length === 0 ? (
            <p className="text-muted-foreground">
              No commands executed yet. Type a command above and press Execute.
            </p>
          ) : (
            <div className="space-y-4">
              {history.map((entry, i) => (
                <div key={i}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      [{formatTime(entry.timestamp)}]
                    </span>
                    <span className="text-primary">$</span>
                    <span className="text-foreground">{entry.command}</span>
                  </div>
                  <div
                    className={`mt-1 whitespace-pre-wrap pl-4 ${
                      entry.success
                        ? "text-muted-foreground"
                        : "text-destructive"
                    }`}
                  >
                    {entry.message}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
