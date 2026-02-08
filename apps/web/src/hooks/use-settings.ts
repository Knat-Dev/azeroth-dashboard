"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/providers/toast-provider";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";

const DEFAULT_SETTINGS: Record<string, string> = {
  autoRestartEnabled: "false",
  autoRestartCooldown: "10000",
  autoRestartMaxRetries: "3",
  autoRestartRetryInterval: "15000",
  crashLoopThreshold: "3",
  crashLoopWindow: "300000",
  discordWebhookUrl: "",
  webhookEvents: "crash,restart_failed,crash_loop,backup_success,backup_failed",
  faction_theme: "neutral",
};

export function msToSeconds(ms: string | undefined): string {
  if (!ms) return "";
  const num = parseInt(ms, 10);
  if (isNaN(num)) return "";
  return String(num / 1000);
}

export function secondsToMs(seconds: string): string {
  const num = parseFloat(seconds);
  if (isNaN(num)) return "0";
  return String(Math.round(num * 1000));
}

export function useSettings() {
  const [settings, setSettings] = useState<Record<string, string>>(DEFAULT_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingSending, setTestingSending] = useState(false);
  const { toast } = useToast();

  const isDirty = useMemo(
    () => !loading && JSON.stringify(settings) !== originalSettings,
    [settings, loading, originalSettings],
  );

  useUnsavedChanges(isDirty);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Record<string, string>>("/admin/settings");
      const merged = { ...DEFAULT_SETTINGS, ...data };
      setSettings(merged);
      setOriginalSettings(JSON.stringify(merged));
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  function updateSetting(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function getWebhookEvents(): string[] {
    const raw = settings.webhookEvents || "";
    if (!raw.trim()) return [];
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }

  function toggleWebhookEvent(event: string) {
    const current = getWebhookEvents();
    const next = current.includes(event)
      ? current.filter((e) => e !== event)
      : [...current, event];
    updateSetting("webhookEvents", next.join(","));
  }

  function validateSettings(): string | null {
    const cooldown = parseInt(settings["autoRestartCooldown"] ?? "0", 10);
    if (isNaN(cooldown) || cooldown < 0) return "Cooldown must be a non-negative number";

    const maxRetries = parseInt(settings["autoRestartMaxRetries"] ?? "0", 10);
    if (isNaN(maxRetries) || maxRetries < 0 || maxRetries > 20) return "Max retries must be between 0 and 20";

    const retryInterval = parseInt(settings["autoRestartRetryInterval"] ?? "0", 10);
    if (isNaN(retryInterval) || retryInterval < 0) return "Retry interval must be a non-negative number";

    const threshold = parseInt(settings["crashLoopThreshold"] ?? "0", 10);
    if (isNaN(threshold) || threshold < 1 || threshold > 50) return "Crash threshold must be between 1 and 50";

    const window = parseInt(settings["crashLoopWindow"] ?? "0", 10);
    if (isNaN(window) || window < 0) return "Detection window must be a non-negative number";

    const webhookUrl = settings["discordWebhookUrl"]?.trim();
    if (webhookUrl && !webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
      return "Webhook URL must start with https://discord.com/api/webhooks/";
    }

    return null;
  }

  async function handleSave(): Promise<boolean> {
    const validationError = validateSettings();
    if (validationError) {
      toast("error", validationError);
      return false;
    }

    setSaving(true);
    try {
      await api.put("/admin/settings", settings);
      setOriginalSettings(JSON.stringify(settings));
      toast("success", "Settings saved successfully");
      return true;
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Failed to save settings");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleTestWebhook() {
    setTestingSending(true);
    try {
      const result = await api.post<{ success: boolean; message: string }>(
        "/admin/webhook/test",
      );
      if (result.success) {
        toast("success", "Test notification sent to Discord");
      } else {
        toast("error", result.message);
      }
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Failed to send test");
    } finally {
      setTestingSending(false);
    }
  }

  return {
    settings,
    loading,
    saving,
    testingSending,
    isDirty,
    updateSetting,
    getWebhookEvents,
    toggleWebhookEvent,
    handleSave,
    handleTestWebhook,
  };
}
