"use client";

import { useRef, useEffect } from "react";
import { useSettings, msToSeconds, secondsToMs } from "@/hooks/use-settings";
import { useTheme } from "@/providers/theme-provider";
import { Settings, Save, RefreshCw, Bell, Send, Palette, MapIcon } from "lucide-react";

const WEBHOOK_EVENT_OPTIONS = [
  { value: "crash", label: "Server Crash" },
  { value: "restart_failed", label: "Restart Failed" },
  { value: "crash_loop", label: "Crash Loop Detected" },
  { value: "backup_success", label: "Backup Success" },
  { value: "backup_failed", label: "Backup Failed" },
];

const FACTION_OPTIONS = [
  {
    value: "neutral" as const,
    label: "Neutral",
    color: "#f5a623",
    desc: "Default gold theme",
  },
  {
    value: "alliance" as const,
    label: "Alliance",
    color: "#1A6BC4",
    desc: "For the Alliance!",
  },
  {
    value: "horde" as const,
    label: "Horde",
    color: "#9B1B1B",
    desc: "For the Horde!",
  },
];

export default function SettingsPage() {
  const {
    settings, loading, saving, testingSending, isDirty,
    updateSetting, getWebhookEvents, toggleWebhookEvent, handleSave, handleTestWebhook,
  } = useSettings();
  const { faction, setFaction, previewFaction } = useTheme();

  // Track faction for preview-with-revert behaviour
  const lastSavedFactionRef = useRef(faction);
  const currentFactionRef = useRef(faction);
  currentFactionRef.current = faction;

  useEffect(() => {
    lastSavedFactionRef.current = faction;
    return () => {
      // On unmount, revert to last-saved faction if unsaved preview is active
      if (currentFactionRef.current !== lastSavedFactionRef.current) {
        setFaction(lastSavedFactionRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSaveAll() {
    const success = await handleSave();
    if (success) {
      setFaction(faction); // persist current preview to localStorage
      lastSavedFactionRef.current = faction;
    }
  }

  const inputClasses =
    "w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure auto-restart, crash loop protection, and webhooks
          </p>
        </div>
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure auto-restart, crash loop protection, and webhooks
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {isDirty && (
            <span className="text-xs text-yellow-400">Unsaved changes</span>
          )}
          <button
            onClick={handleSaveAll}
            disabled={saving || !isDirty}
            className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>

      {/* Faction Theme Section */}
      <div className="rounded-xl glass p-3 md:p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="rounded-lg bg-secondary p-2">
            <Palette className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Faction Theme
            </h2>
            <p className="text-xs text-muted-foreground/70">
              Choose your faction to customize the dashboard colors
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {FACTION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                previewFaction(opt.value);
                updateSetting("faction_theme", opt.value);
              }}
              className={`flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-all ${
                faction === opt.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/30 hover:bg-secondary/50"
              }`}
            >
              <div
                className="h-8 w-8 shrink-0 rounded-full"
                style={{ backgroundColor: opt.color }}
              />
              <div>
                <p className="text-sm font-medium text-foreground">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Auto-Restart Section */}
      <div className="rounded-xl glass p-3 md:p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="rounded-lg bg-secondary p-2">
            <RefreshCw className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Auto-Restart
            </h2>
            <p className="text-xs text-muted-foreground/70">
              Automatically restart crashed servers
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-foreground">
                Enable Auto-Restart
              </label>
              <p className="text-xs text-muted-foreground">
                Automatically restart servers when they crash
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.autoRestartEnabled === "true"}
              onClick={() =>
                updateSetting(
                  "autoRestartEnabled",
                  settings.autoRestartEnabled === "true" ? "false" : "true",
                )
              }
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-card ${
                settings.autoRestartEnabled === "true"
                  ? "bg-primary"
                  : "bg-secondary"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-foreground shadow-lg transition-transform duration-200 ${
                  settings.autoRestartEnabled === "true"
                    ? "translate-x-5"
                    : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Cooldown */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Cooldown (seconds)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={msToSeconds(settings.autoRestartCooldown)}
                onChange={(e) =>
                  updateSetting("autoRestartCooldown", secondsToMs(e.target.value))
                }
                className={inputClasses}
                placeholder="10"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Wait before first restart attempt
              </p>
            </div>

            {/* Max Retries */}
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Max Retries
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={settings.autoRestartMaxRetries}
                onChange={(e) =>
                  updateSetting("autoRestartMaxRetries", e.target.value)
                }
                className={inputClasses}
                placeholder="3"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Number of restart attempts
              </p>
            </div>

            {/* Retry Interval */}
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Retry Interval (seconds)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={msToSeconds(settings.autoRestartRetryInterval)}
                onChange={(e) =>
                  updateSetting("autoRestartRetryInterval", secondsToMs(e.target.value))
                }
                className={inputClasses}
                placeholder="15"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Time between retry attempts
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Crash Loop Protection Section */}
      <div className="rounded-xl glass p-3 md:p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="rounded-lg bg-secondary p-2">
            <Settings className="h-4 w-4 text-yellow-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Crash Loop Protection
            </h2>
            <p className="text-xs text-muted-foreground/70">
              Detect and prevent repeated crash-restart cycles
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Threshold */}
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Crash Threshold
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={settings.crashLoopThreshold}
              onChange={(e) =>
                updateSetting("crashLoopThreshold", e.target.value)
              }
              className={inputClasses}
              placeholder="3"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Number of crashes to trigger crash loop detection
            </p>
          </div>

          {/* Window */}
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Detection Window (seconds)
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={msToSeconds(settings.crashLoopWindow)}
              onChange={(e) =>
                updateSetting("crashLoopWindow", secondsToMs(e.target.value))
              }
              className={inputClasses}
              placeholder="300"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Time window for counting crashes
            </p>
          </div>
        </div>
      </div>

      {/* Map Position Tracking Section */}
      <div className="rounded-xl glass p-3 md:p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="rounded-lg bg-secondary p-2">
            <MapIcon className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Map Position Tracking
            </h2>
            <p className="text-xs text-muted-foreground/70">
              Force periodic character saves for live map positions
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-foreground">
                Enable Position Tracking
              </label>
              <p className="text-xs text-muted-foreground">
                Periodically send .saveall via SOAP to refresh character positions in the database
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.mapSaveEnabled === "true"}
              onClick={() =>
                updateSetting(
                  "mapSaveEnabled",
                  settings.mapSaveEnabled === "true" ? "false" : "true",
                )
              }
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-card ${
                settings.mapSaveEnabled === "true"
                  ? "bg-primary"
                  : "bg-secondary"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-foreground shadow-lg transition-transform duration-200 ${
                  settings.mapSaveEnabled === "true"
                    ? "translate-x-5"
                    : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Save Interval */}
          <div className="max-w-xs">
            <label className="mb-1 block text-sm font-medium text-foreground">
              Save Interval (seconds)
            </label>
            <input
              type="number"
              min="10"
              max="120"
              step="5"
              value={msToSeconds(settings.mapSaveInterval)}
              onChange={(e) =>
                updateSetting("mapSaveInterval", secondsToMs(e.target.value))
              }
              className={inputClasses}
              placeholder="30"
            />
            <p className="mt-1 text-xs text-yellow-400/80">
              Forces worldserver to save all character data at this interval. Lower values = more
              accurate map positions but increased DB write load.
            </p>
          </div>
        </div>
      </div>

      {/* Discord Webhooks Section */}
      <div className="rounded-xl glass p-3 md:p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="rounded-lg bg-secondary p-2">
            <Bell className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Discord Webhooks
            </h2>
            <p className="text-xs text-muted-foreground/70">
              Send notifications to a Discord channel
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Webhook URL */}
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Webhook URL
            </label>
            <input
              type="text"
              value={settings.discordWebhookUrl}
              onChange={(e) =>
                updateSetting("discordWebhookUrl", e.target.value)
              }
              className={inputClasses}
              placeholder="https://discord.com/api/webhooks/..."
            />
            <div className="mt-2 flex items-center gap-3">
              <p className="text-xs text-muted-foreground">
                Leave empty to disable Discord notifications
              </p>
              {settings.discordWebhookUrl?.trim() && (
                <button
                  onClick={handleTestWebhook}
                  disabled={testingSending}
                  className="flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
                >
                  {testingSending ? (
                    <>
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-3 w-3" />
                      Send Test
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Webhook Events */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Notification Events
            </label>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              {WEBHOOK_EVENT_OPTIONS.map((event) => (
                <label
                  key={event.value}
                  className="flex items-center gap-2 text-sm text-foreground cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={getWebhookEvents().includes(event.value)}
                    onChange={() => toggleWebhookEvent(event.value)}
                    className="h-4 w-4 rounded border-input bg-secondary text-primary focus:ring-2 focus:ring-ring"
                  />
                  {event.label}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Select which events trigger a Discord notification
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
