"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

interface Profile {
  id: number;
  username: string;
  email: string;
  joindate: string;
  lastIp: string;
  lastLogin: string;
  expansion: number;
  gmLevel: number;
}

export default function AccountPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<Profile>("/accounts/me").then(setProfile).catch(() => {});
  }, []);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");
    try {
      await api.patch("/accounts/me/password", { currentPassword, newPassword });
      setMessage("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password");
    }
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");
    try {
      await api.patch("/accounts/me/email", { email: newEmail });
      setMessage("Email changed successfully");
      setNewEmail("");
      if (profile) setProfile({ ...profile, email: newEmail.toUpperCase() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change email");
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Account Settings</h1>

      {message && (
        <div className="mb-4 rounded-lg bg-green-500/10 px-4 py-3 text-sm text-green-400">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {profile && (
        <div className="mb-8 rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Profile</h2>
          <div className="grid gap-3 text-sm">
            {[
              ["Username", profile.username],
              ["Email", profile.email || "Not set"],
              ["Joined", new Date(profile.joindate).toLocaleDateString()],
              ["Last Login", profile.lastLogin ? new Date(profile.lastLogin).toLocaleString() : "Never"],
              ["Last IP", profile.lastIp],
              ["Expansion", profile.expansion === 2 ? "WoTLK" : `${profile.expansion}`],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="text-muted-foreground">{label}</span>
                <span className="text-foreground">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-8 rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Change Password</h2>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            required
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (6-16 characters)"
            minLength={6}
            maxLength={16}
            className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            required
          />
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Change Password
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Change Email</h2>
        <form onSubmit={handleChangeEmail} className="flex gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="New email address"
            className="flex-1 rounded-lg border border-input bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            required
          />
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Update
          </button>
        </form>
      </div>
    </div>
  );
}
