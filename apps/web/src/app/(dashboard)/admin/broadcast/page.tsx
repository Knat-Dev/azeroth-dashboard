"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

interface AutoBroadcast {
  id: number;
  text: string;
  weight: number;
}

type BroadcastType = "announce" | "notify" | "both";

export default function BroadcastPage() {
  const [message, setMessage] = useState("");
  const [broadcastType, setBroadcastType] = useState<BroadcastType>("announce");
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState("");
  const [sendError, setSendError] = useState("");

  const [autobroadcasts, setAutobroadcasts] = useState<AutoBroadcast[]>([]);
  const [abLoading, setAbLoading] = useState(true);
  const [abError, setAbError] = useState("");
  const [reloading, setReloading] = useState(false);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newText, setNewText] = useState("");
  const [newWeight, setNewWeight] = useState("1");
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editWeight, setEditWeight] = useState("");

  const fetchAutobroadcasts = useCallback(() => {
    setAbLoading(true);
    setAbError("");
    api
      .get<AutoBroadcast[]>("/admin/autobroadcast")
      .then(setAutobroadcasts)
      .catch((e) => setAbError(e.message))
      .finally(() => setAbLoading(false));
  }, []);

  useEffect(() => {
    fetchAutobroadcasts();
  }, [fetchAutobroadcasts]);

  async function handleSendBroadcast(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    setSendError("");
    setSendSuccess("");

    try {
      await api.post("/admin/broadcast", {
        message: message.trim(),
        type: broadcastType,
      });
      setSendSuccess("Broadcast sent successfully.");
      setMessage("");
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Failed to send broadcast");
    } finally {
      setSending(false);
    }
  }

  async function handleCreate() {
    if (!newText.trim()) return;
    setCreating(true);
    setAbError("");
    try {
      await api.post("/admin/autobroadcast", {
        text: newText.trim(),
        weight: parseInt(newWeight) || 1,
      });
      setNewText("");
      setNewWeight("1");
      setShowCreateForm(false);
      fetchAutobroadcasts();
    } catch (e) {
      setAbError(e instanceof Error ? e.message : "Failed to create autobroadcast");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: number) {
    setAbError("");
    try {
      await api.delete(`/admin/autobroadcast/${id}`);
      fetchAutobroadcasts();
    } catch (e) {
      setAbError(e instanceof Error ? e.message : "Failed to delete autobroadcast");
    }
  }

  function startEdit(ab: AutoBroadcast) {
    setEditingId(ab.id);
    setEditText(ab.text);
    setEditWeight(String(ab.weight));
  }

  async function handleSaveEdit() {
    if (editingId === null || !editText.trim()) return;
    setAbError("");
    try {
      await api.put(`/admin/autobroadcast/${editingId}`, {
        text: editText.trim(),
        weight: parseInt(editWeight) || 1,
      });
      setEditingId(null);
      fetchAutobroadcasts();
    } catch (e) {
      setAbError(e instanceof Error ? e.message : "Failed to update autobroadcast");
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText("");
    setEditWeight("");
  }

  async function handleReload() {
    setReloading(true);
    setAbError("");
    try {
      await api.post("/admin/autobroadcast/reload");
      fetchAutobroadcasts();
    } catch (e) {
      setAbError(e instanceof Error ? e.message : "Failed to reload autobroadcasts");
    } finally {
      setReloading(false);
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">Broadcast</h1>

      {/* Send Broadcast Section */}
      <div className="mb-8 rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Send Broadcast
        </h2>

        {sendError && (
          <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {sendError}
          </div>
        )}
        {sendSuccess && (
          <div className="mb-4 rounded-lg bg-green-500/10 px-4 py-3 text-sm text-green-400">
            {sendSuccess}
          </div>
        )}

        <form onSubmit={handleSendBroadcast} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Enter broadcast message..."
              rows={3}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Type
            </label>
            <div className="flex gap-4">
              {(["announce", "notify", "both"] as const).map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="broadcastType"
                    value={t}
                    checked={broadcastType === t}
                    onChange={() => setBroadcastType(t)}
                    className="accent-primary"
                  />
                  <span className="text-foreground capitalize">{t}</span>
                </label>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={sending || !message.trim()}
            className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {sending ? "Sending..." : "Send Broadcast"}
          </button>
        </form>
      </div>

      {/* Autobroadcast Section */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Autobroadcast
          </h2>
          <div className="flex gap-2">
            <button
              onClick={handleReload}
              disabled={reloading}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-secondary disabled:opacity-50 transition-colors"
            >
              {reloading ? "Reloading..." : "Reload"}
            </button>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {showCreateForm ? "Cancel" : "New"}
            </button>
          </div>
        </div>

        {abError && (
          <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {abError}
          </div>
        )}

        {showCreateForm && (
          <div className="mb-4 rounded-lg border border-border bg-secondary p-4">
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Text
                </label>
                <textarea
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Autobroadcast message..."
                  rows={2}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Weight
                </label>
                <input
                  type="number"
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                  min={1}
                  className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <button
                onClick={handleCreate}
                disabled={creating || !newText.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        )}

        {abLoading ? (
          <div className="text-muted-foreground">
            Loading autobroadcasts...
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    ID
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Text
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Weight
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {autobroadcasts.map((ab) => (
                  <tr
                    key={ab.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3 font-mono text-foreground">
                      {ab.id}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {editingId === ab.id ? (
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          rows={2}
                        />
                      ) : (
                        <span className="line-clamp-2">{ab.text}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {editingId === ab.id ? (
                        <input
                          type="number"
                          value={editWeight}
                          onChange={(e) => setEditWeight(e.target.value)}
                          min={1}
                          className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      ) : (
                        ab.weight
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingId === ab.id ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={handleSaveEdit}
                            className="rounded-lg bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="rounded-lg border border-border px-3 py-1 text-xs text-foreground hover:bg-secondary transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => startEdit(ab)}
                            className="rounded-lg bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(ab.id)}
                            className="rounded-lg bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {autobroadcasts.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No autobroadcasts configured.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
