"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";

type Step = "welcome" | "admin" | "faction" | "theme" | "complete";
type Faction = "alliance" | "horde" | "neutral";
type BaseTheme = "dark" | "light" | "system";

const STEPS: Step[] = ["welcome", "admin", "faction", "theme", "complete"];

const FACTION_OPTIONS: { value: Faction; label: string; color: string; desc: string }[] = [
  { value: "neutral", label: "Neutral", color: "#f5a623", desc: "Default gold theme" },
  { value: "alliance", label: "Alliance", color: "#1A6BC4", desc: "For the Alliance!" },
  { value: "horde", label: "Horde", color: "#9B1B1B", desc: "For the Horde!" },
];

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [faction, setFaction] = useState<Faction>("neutral");
  const [baseTheme, setBaseTheme] = useState<BaseTheme>("dark");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check if setup is actually needed
  useEffect(() => {
    fetch(`${API_URL}/setup/status`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.needsSetup) {
          router.push("/login");
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [router]);

  // Live preview faction theme
  useEffect(() => {
    const el = document.documentElement;
    el.classList.remove("faction-alliance", "faction-horde", "faction-neutral");
    el.classList.add(`faction-${faction}`);
  }, [faction]);

  // Live preview base theme
  useEffect(() => {
    const el = document.documentElement;
    el.classList.remove("dark", "light");
    let resolved = baseTheme;
    if (resolved === "system") {
      resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    el.classList.add(resolved);
    el.style.colorScheme = resolved;
  }, [baseTheme]);

  const stepIndex = STEPS.indexOf(step);

  function nextStep() {
    setError("");
    if (step === "admin") {
      if (!username.trim() || username.length < 3 || username.length > 16) {
        setError("Username must be between 3 and 16 characters");
        return;
      }
      if (!password || password.length < 6 || password.length > 16) {
        setError("Password must be between 6 and 16 characters");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
    }
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next);
  }

  function prevStep() {
    setError("");
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev);
  }

  async function handleComplete() {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/setup/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          email: email || undefined,
          faction,
          baseTheme,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Setup failed");
      }
      // Store theme preferences in localStorage
      localStorage.setItem("faction", faction);
      localStorage.setItem("theme", baseTheme);
      // Redirect to login
      router.push("/login");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Setup failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1.5 w-10 rounded-full transition-colors ${
                i <= stepIndex ? "bg-primary" : "bg-secondary"
              }`}
            />
          ))}
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-lg">
          {/* Welcome */}
          {step === "welcome" && (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
                <span className="text-2xl font-bold text-primary-foreground">AC</span>
              </div>
              <h1 className="text-2xl font-bold text-foreground">Welcome to Azeroth Dashboard</h1>
              <p className="mt-3 text-sm text-muted-foreground">
                Let&apos;s set up your dashboard. You&apos;ll create an administrator account
                and choose your preferred theme.
              </p>
              <button
                onClick={nextStep}
                className="mt-6 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Get Started
              </button>
            </div>
          )}

          {/* Create Admin */}
          {step === "admin" && (
            <div>
              <h2 className="text-xl font-bold text-foreground">Create Admin Account</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                This will be your GM account for both the dashboard and the game server.
              </p>

              {error && (
                <div className="mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Username <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    maxLength={16}
                    className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Choose a username"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Password <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    maxLength={16}
                    className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Choose a password (6-16 chars)"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Confirm Password <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    maxLength={16}
                    className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Confirm your password"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Email <span className="text-muted-foreground">(optional)</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="admin@example.com"
                  />
                </div>
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  onClick={prevStep}
                  className="flex-1 rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={nextStep}
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Choose Faction */}
          {step === "faction" && (
            <div>
              <h2 className="text-xl font-bold text-foreground">Choose Your Side</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pick a faction theme for your dashboard. This changes the primary color scheme.
              </p>

              <div className="mt-4 grid gap-3">
                {FACTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFaction(opt.value)}
                    className={`flex items-center gap-4 rounded-lg border-2 p-4 text-left transition-all ${
                      faction === opt.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <div
                      className="h-10 w-10 shrink-0 rounded-full"
                      style={{ backgroundColor: opt.color }}
                    />
                    <div>
                      <p className="text-sm font-medium text-foreground">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  onClick={prevStep}
                  className="flex-1 rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={nextStep}
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Base Theme */}
          {step === "theme" && (
            <div>
              <h2 className="text-xl font-bold text-foreground">Base Theme</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose between dark and light mode.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {(["dark", "light", "system"] as BaseTheme[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setBaseTheme(t)}
                    className={`rounded-lg border-2 p-4 text-center transition-all ${
                      baseTheme === t
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <p className="text-sm font-medium capitalize text-foreground">{t}</p>
                  </button>
                ))}
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  onClick={prevStep}
                  className="flex-1 rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={nextStep}
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Complete */}
          {step === "complete" && (
            <div>
              <h2 className="text-xl font-bold text-foreground">Ready to Go</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Review your settings and complete the setup.
              </p>

              <div className="mt-4 space-y-2 rounded-lg border border-border bg-secondary/50 p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Username</span>
                  <span className="font-medium text-foreground">{username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium text-foreground">{email || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Faction</span>
                  <span className="font-medium capitalize text-foreground">{faction}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Theme</span>
                  <span className="font-medium capitalize text-foreground">{baseTheme}</span>
                </div>
              </div>

              {error && (
                <div className="mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="mt-5 flex gap-3">
                <button
                  onClick={prevStep}
                  disabled={submitting}
                  className="flex-1 rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  onClick={handleComplete}
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {submitting ? "Setting up..." : "Complete Setup"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
