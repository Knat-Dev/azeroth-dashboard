"use client";

import { useEffect, useRef, useState } from "react";
import { api, API_URL } from "@/lib/api";
import { getStoredToken } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface BackupSetFile {
  filename: string;
  database: string;
  size: number;
}

interface BackupSet {
  id: string;
  createdAt: string;
  databases: string[];
  files: BackupSetFile[];
  totalSize: number;
  isPreRestore: boolean;
  label: string;
}

interface Schedule {
  enabled: boolean;
  cron: string;
  databases: string[];
  retentionDays: number;
}

interface SetRestoreResult {
  success: boolean;
  setId: string;
  databases: string[];
  filesRestored: number;
  totalTablesRestored: number;
  totalStatementsExecuted: number;
  preRestoreSetId: string | null;
  durationMs: number;
  errors: { database: string; error: string }[];
}

type RestoreStepStatus = "pending" | "in_progress" | "done" | "failed" | "skipped";

interface RestoreStep {
  id: string;
  label: string;
  status: RestoreStepStatus;
  error?: string;
}

interface RestoreProgress {
  operationId: string;
  setId: string;
  status: "running" | "completed" | "failed" | "cancelled";
  steps: RestoreStep[];
  result?: SetRestoreResult;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

const ALL_DBS = ["acore_auth", "acore_characters", "acore_playerbots", "acore_world"];

export default function BackupsPage() {
  const [sets, setSets] = useState<BackupSet[]>([]);
  const [selectedDbs, setSelectedDbs] = useState<string[]>(["acore_auth", "acore_characters"]);
  const [backing, setBacking] = useState(false);
  const [, setSchedule] = useState<Schedule | null>(null);
  const [scheduleEdit, setScheduleEdit] = useState<Schedule | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [confirmRestore, setConfirmRestore] = useState<BackupSet | null>(null);
  const [restoreOp, setRestoreOp] = useState<{ operationId: string; setId: string } | null>(null);
  const [progress, setProgress] = useState<RestoreProgress | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BackupSet | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const stepStartRef = useRef<number>(0);

  const [showNewBackup, setShowNewBackup] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on click outside
  useEffect(() => {
    if (!showNewBackup) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowNewBackup(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showNewBackup]);

  // Tick elapsed timer every second while a step is in_progress
  useEffect(() => {
    const hasActive = progress?.steps.some(s => s.status === "in_progress");
    if (!hasActive) {
      setElapsed(0);
      return;
    }
    stepStartRef.current = Date.now();
    setElapsed(0);
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - stepStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [progress?.steps.find(s => s.status === "in_progress")?.id]);

  function showMessage(text: string, type: "success" | "error" = "success") {
    setMessage(text);
    setMessageType(type);
  }

  function loadSets() {
    api.get<BackupSet[]>("/admin/backups").then(setSets).catch(() => {});
  }

  function loadSchedule() {
    api.get<Schedule>("/admin/backups/schedule").then((s) => {
      setSchedule(s);
      setScheduleEdit(s);
    }).catch(() => {});
  }

  useEffect(() => {
    loadSets();
    loadSchedule();
  }, []);

  useEffect(() => {
    if (!restoreOp) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const p = await api.get<RestoreProgress>(
          `/admin/backups/restore-operations/${restoreOp.operationId}`
        );
        if (!cancelled) {
          setProgress(p);
          if (p.status === "completed" || p.status === "failed" || p.status === "cancelled") {
            setRestoreOp(null);
            loadSets();
          }
        }
      } catch { /* ignore poll errors */ }
    };
    poll();
    const timer = setInterval(poll, 1500);
    return () => { cancelled = true; clearInterval(timer); };
  }, [restoreOp]);

  async function handleBackup() {
    if (selectedDbs.length === 0) return;
    setBacking(true);
    setMessage("");
    try {
      await api.post("/admin/backups", { databases: selectedDbs });
      showMessage("Backup completed");
      loadSets();
      setShowNewBackup(false);
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Backup failed", "error");
    } finally {
      setBacking(false);
    }
  }

  async function handleDownloadFile(filename: string) {
    try {
      const res = await fetch(`${API_URL}/admin/backups/files/${encodeURIComponent(filename)}`, {
        headers: { Authorization: `Bearer ${getStoredToken()}` },
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showMessage("Download failed", "error");
    }
  }

  async function handleDeleteSet(set: BackupSet) {
    try {
      await api.delete(`/admin/backups/sets/${encodeURIComponent(set.id)}`);
      showMessage("Backup set deleted");
      setConfirmDelete(null);
      loadSets();
    } catch {
      showMessage("Failed to delete backup set", "error");
    }
  }

  async function handleRestore(set: BackupSet) {
    setConfirmRestore(null);
    setProgress(null);
    setMessage("");
    try {
      const { operationId } = await api.post<{ operationId: string }>(
        `/admin/backups/sets/${encodeURIComponent(set.id)}/restore`
      );
      setRestoreOp({ operationId, setId: set.id });
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Restore failed", "error");
    }
  }

  async function handleSaveSchedule() {
    if (!scheduleEdit) return;
    await api.put("/admin/backups/schedule", scheduleEdit);
    setSchedule(scheduleEdit);
    showMessage("Schedule saved");
  }

  function toggleDb(db: string) {
    setSelectedDbs((prev) =>
      prev.includes(db) ? prev.filter((d) => d !== db) : [...prev, db],
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="mb-6 flex shrink-0 items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Database Backups</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSchedule(true)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-secondary"
          >
            Schedule
          </button>
          <div className="relative" ref={popoverRef}>
            <button
              onClick={() => setShowNewBackup(v => !v)}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              + New Backup
            </button>
            {showNewBackup && (
              <div className="absolute right-0 top-full mt-2 z-40 w-64 rounded-xl border border-border bg-card p-4 shadow-xl">
                <p className="mb-3 text-sm font-medium text-foreground">Select databases</p>
                <div className="mb-3 space-y-2">
                  {ALL_DBS.map((db) => (
                    <label key={db} className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={selectedDbs.includes(db)}
                        onChange={() => toggleDb(db)}
                        className="rounded border-input"
                      />
                      {db}
                    </label>
                  ))}
                </div>
                <button
                  onClick={handleBackup}
                  disabled={backing || selectedDbs.length === 0}
                  className="w-full rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {backing ? "Backing up..." : "Start Backup"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {message && (
        <div className={`mb-4 shrink-0 rounded-lg px-4 py-3 text-sm ${
          messageType === "error"
            ? "bg-destructive/10 text-destructive"
            : "bg-green-500/10 text-green-400"
        }`}>
          {message}
        </div>
      )}

      {/* Backup Sets Table — fills remaining space */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-border bg-card">
        {/* Restore progress panel */}
        {progress && (
          <div className={`border-b p-6 ${
            progress.status === "completed"
              ? "border-green-500/30 bg-green-500/10"
              : progress.status === "failed" || progress.status === "cancelled"
              ? "border-destructive/30 bg-destructive/10"
              : "border-blue-500/30 bg-blue-500/10"
          }`}>
            <div className="mb-3 flex items-center justify-between">
              <span className={`text-lg font-semibold ${
                progress.status === "completed" ? "text-green-400"
                  : progress.status === "failed" ? "text-destructive"
                  : progress.status === "cancelled" ? "text-amber-400"
                  : "text-blue-400"
              }`}>
                {progress.status === "completed" ? "Restore Successful"
                  : progress.status === "failed" ? "Restore Failed"
                  : progress.status === "cancelled" ? "Restore Cancelled"
                  : "Restoring..."}
              </span>
              {progress.status === "running" && restoreOp && (
                <button
                  onClick={async () => {
                    try {
                      await api.post(`/admin/backups/restore-operations/${restoreOp.operationId}/cancel`);
                    } catch { /* ignore */ }
                  }}
                  className="rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                >
                  Cancel
                </button>
              )}
            </div>
            <div className="space-y-2">
              {progress.steps.map((step) => (
                <div key={step.id} className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                    {step.status === "done" && (
                      <svg className="h-4 w-4 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                    {step.status === "failed" && (
                      <svg className="h-4 w-4 text-destructive" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    )}
                    {step.status === "in_progress" && (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                    )}
                    {(step.status === "pending" || step.status === "skipped") && (
                      <div className="h-3 w-3 rounded-full border-2 border-muted-foreground/30" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <span className={`text-sm ${
                      step.status === "done" ? "text-green-400"
                        : step.status === "failed" ? "text-destructive"
                        : step.status === "in_progress" ? "text-foreground"
                        : "text-muted-foreground"
                    }`}>
                      {step.label}
                      {step.status === "in_progress" && elapsed > 0 && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
                          {step.id.startsWith("stop_") && " / 6:00"}
                          {step.id.startsWith("pre_backup_") && " / 5:00"}
                          {step.id.startsWith("restore_") && " / 10:00"}
                        </span>
                      )}
                    </span>
                    {step.error && (
                      <p className="mt-0.5 text-xs text-destructive break-all">{step.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {progress.status === "completed" && progress.result && (
              <div className="mt-4 space-y-1 text-sm text-muted-foreground border-t border-green-500/20 pt-3">
                <p>Databases: {progress.result.databases.join(", ")}</p>
                <p>
                  {progress.result.totalTablesRestored} tables, {progress.result.totalStatementsExecuted} statements
                  in {(progress.result.durationMs / 1000).toFixed(1)}s
                </p>
                {progress.result.preRestoreSetId && (
                  <p>Pre-restore backup saved as set: {progress.result.preRestoreSetId}</p>
                )}
              </div>
            )}
            {progress.status === "cancelled" && progress.result && (
              <div className="mt-4 space-y-1 text-sm border-t border-amber-500/20 pt-3">
                <p className="text-muted-foreground">
                  Restore was cancelled. Servers have been restarted.
                </p>
                {progress.result.preRestoreSetId && (
                  <p className="text-muted-foreground">
                    Pre-restore backup available: {progress.result.preRestoreSetId}
                  </p>
                )}
              </div>
            )}
            {progress.status === "failed" && progress.result && (
              <div className="mt-4 space-y-1 text-sm border-t border-destructive/20 pt-3">
                {progress.result.preRestoreSetId && (
                  <p className="text-muted-foreground">
                    Pre-restore backup available: {progress.result.preRestoreSetId}
                  </p>
                )}
                {progress.result.errors.length > 0 && (
                  <div>
                    {progress.result.errors.map((e, i) => (
                      <p key={i} className="text-destructive text-xs">{e.database}: {e.error}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
            {(progress.status === "completed" || progress.status === "failed" || progress.status === "cancelled") && (
              <button
                onClick={() => setProgress(null)}
                className="mt-3 text-xs text-muted-foreground hover:text-foreground"
              >
                Dismiss
              </button>
            )}
          </div>
        )}

        {sets.length === 0 ? (
          <p className="p-4 text-muted-foreground">No backups found.</p>
        ) : (
          sets.map((set) => (
            <div
              key={set.id}
              className={cn(
                "flex items-center justify-between gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-secondary/50 transition-colors",
                set.isPreRestore && "border-l-4 border-l-amber-500"
              )}
            >
              {/* Info — wraps freely */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 min-w-0">
                <span className="text-sm text-foreground whitespace-nowrap">
                  {new Date(set.createdAt).toLocaleString()}
                </span>
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                  set.isPreRestore
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-secondary text-muted-foreground"
                )}>
                  {set.label}
                </span>
                <div className="flex flex-wrap gap-1">
                  {set.databases.map((db) => (
                    <span key={db} className="rounded-md bg-secondary px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                      {db}
                    </span>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatSize(set.totalSize)}
                </span>
              </div>
              {/* Actions — always stays together on the right */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setConfirmRestore(set)}
                  disabled={restoreOp !== null}
                  className="rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Restore
                </button>
                <button
                  onClick={() => {
                    for (const file of set.files) {
                      handleDownloadFile(file.filename);
                    }
                  }}
                  className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary"
                  title="Download"
                >
                  DL
                </button>
                <button
                  onClick={() => setConfirmDelete(set)}
                  className="rounded-lg border border-destructive/30 px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Restore confirmation dialog */}
      {confirmRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <h3 className="mb-3 text-lg font-semibold text-foreground">Confirm Restore</h3>
            <div className="mb-4 space-y-2 text-sm text-muted-foreground">
              <p>
                Restore backup from{" "}
                <span className="font-medium text-foreground">
                  {new Date(confirmRestore.createdAt).toLocaleString()}
                </span>
              </p>
              <p>
                Databases:{" "}
                <span className="font-medium text-foreground">
                  {confirmRestore.databases.join(", ")}
                </span>
              </p>
              <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-amber-400">
                Warning: The game servers will be stopped during the restore process.
                A pre-restore backup will be created automatically.
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmRestore(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRestore(confirmRestore)}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                I understand, restore now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <h3 className="mb-3 text-lg font-semibold text-foreground">Delete Backup Set</h3>
            <div className="mb-4 text-sm text-muted-foreground">
              <p>
                Delete backup from{" "}
                <span className="font-medium text-foreground">
                  {new Date(confirmDelete.createdAt).toLocaleString()}
                </span>
                ?
              </p>
              <p className="mt-1">
                This will delete {confirmDelete.files.length} file{confirmDelete.files.length !== 1 ? "s" : ""} ({formatSize(confirmDelete.totalSize)}).
                This cannot be undone.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteSet(confirmDelete)}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule modal */}
      {showSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-foreground">Backup Schedule</h3>
            {scheduleEdit && (
              <div className="space-y-4">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={scheduleEdit.enabled}
                    onChange={(e) =>
                      setScheduleEdit({ ...scheduleEdit, enabled: e.target.checked })
                    }
                    className="rounded border-input"
                  />
                  Enable scheduled backups
                </label>
                <div>
                  <label className="mb-1 block text-sm text-muted-foreground">
                    Cron expression
                  </label>
                  <input
                    type="text"
                    value={scheduleEdit.cron}
                    onChange={(e) =>
                      setScheduleEdit({ ...scheduleEdit, cron: e.target.value })
                    }
                    placeholder="0 3 * * *"
                    className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Default: 0 3 * * * (daily at 3 AM)
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-muted-foreground">
                    Retention (days)
                  </label>
                  <input
                    type="number"
                    value={scheduleEdit.retentionDays}
                    onChange={(e) =>
                      setScheduleEdit({
                        ...scheduleEdit,
                        retentionDays: parseInt(e.target.value, 10) || 30,
                      })
                    }
                    className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  {ALL_DBS.map((db) => (
                    <label key={db} className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={scheduleEdit.databases.includes(db)}
                        onChange={() => {
                          const dbs = scheduleEdit.databases.includes(db)
                            ? scheduleEdit.databases.filter((d) => d !== db)
                            : [...scheduleEdit.databases, db];
                          setScheduleEdit({ ...scheduleEdit, databases: dbs });
                        }}
                        className="rounded border-input"
                      />
                      {db}
                    </label>
                  ))}
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <button
                    onClick={() => setShowSchedule(false)}
                    className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => { handleSaveSchedule(); setShowSchedule(false); }}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Save Schedule
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
