"use client";

import { memo } from "react";
import { useConsole, type ConsoleLine } from "@/hooks/use-console";
import Convert from "ansi-to-html";

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

const CONTAINER_LABELS: Record<string, string> = {
  "ac-worldserver": "Worldserver",
  "ac-authserver": "Authserver",
};

const LogLine = memo(function LogLine({ html }: { html: string }) {
  return (
    <div
      className="whitespace-pre-wrap break-all text-terminal-text"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

export default function ConsolePage() {
  const {
    containers, activeContainer, setActiveContainer,
    lines, connected, error, command, setCommand, executing,
    autoScroll, setAutoScroll, termRef, inputRef, isWorldserver,
    setHistoryIndex,
    handleScroll, handleCommand, handleKeyDown, clearTerminal,
  } = useConsole(toHtml);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
      <div className="ml-3 flex gap-1 overflow-x-auto">
        {containers.map((c) => (
          <button
            key={c.name}
            onClick={() => setActiveContainer(c.name)}
            className={`flex cursor-pointer items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeContainer === c.name
                ? "bg-terminal text-foreground border border-b-0 border-border"
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
      <div
        onClick={() => inputRef.current?.focus()}
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-terminal"
      >
        {/* Terminal header bar */}
        <div className="flex items-center justify-between border-b border-border/50 bg-terminal-header px-4 py-2">
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
            [...lines].reverse().map((line: ConsoleLine) => (
              <LogLine key={line.id} html={line.html} />
            ))
          )}
        </div>

        {/* Command input — only for worldserver */}
        {isWorldserver ? (
          <form
            onSubmit={handleCommand}
            className="flex items-center gap-2 border-t border-border/50 bg-terminal-header px-4 py-2.5"
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
              className="flex-1 bg-transparent font-mono text-sm text-terminal-text placeholder:text-muted-foreground/50 focus:outline-none"
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
          <div className="border-t border-border/50 bg-terminal-header px-4 py-2.5">
            <span className="font-mono text-xs text-muted-foreground/50">
              SOAP commands are only available on the Worldserver tab
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
