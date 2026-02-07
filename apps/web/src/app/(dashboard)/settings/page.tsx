"use client";

import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure auto-restart, webhooks, and backup schedules
        </p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-16">
        <div className="rounded-xl bg-secondary p-4">
          <Settings className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="mt-4 text-sm font-medium text-foreground">
          Coming Soon
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Settings will be available in Phase 2
        </p>
      </div>
    </div>
  );
}
