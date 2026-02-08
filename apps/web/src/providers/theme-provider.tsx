"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";
type Faction = "alliance" | "horde" | "neutral";

interface ThemeContext {
  theme: Theme;
  setTheme: (t: Theme) => void;
  faction: Faction;
  setFaction: (f: Faction) => void;
  previewFaction: (f: Faction) => void;
}

const ThemeCtx = createContext<ThemeContext>({
  theme: "dark",
  setTheme: () => {},
  faction: "neutral",
  setFaction: () => {},
  previewFaction: () => {},
});

export function useTheme() {
  return useContext(ThemeCtx);
}

function resolveClass(theme: Theme): "dark" | "light" {
  if (theme !== "system") return theme;
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyClass(resolved: "dark" | "light") {
  const el = document.documentElement;
  el.classList.remove("dark", "light");
  el.classList.add(resolved);
  el.style.colorScheme = resolved;
}

const FACTION_COLORS: Record<string, Record<"dark" | "light", Record<string, string>>> = {
  alliance: {
    dark: { "--color-primary": "#1A6BC4", "--color-ring": "#1A6BC4", "--color-accent": "#C4A33A", "--color-primary-foreground": "#ffffff" },
    light: { "--color-primary": "#2563EB", "--color-ring": "#2563EB", "--color-accent": "#A88B2A", "--color-primary-foreground": "#ffffff" },
  },
  horde: {
    dark: { "--color-primary": "#9B1B1B", "--color-ring": "#9B1B1B", "--color-accent": "#D4722A", "--color-primary-foreground": "#ffffff" },
    light: { "--color-primary": "#B91C1C", "--color-ring": "#B91C1C", "--color-accent": "#C2631E", "--color-primary-foreground": "#ffffff" },
  },
};

const FACTION_STYLE_PROPS = ["--color-primary", "--color-ring", "--color-accent", "--color-primary-foreground"];

function applyFactionColors(faction: Faction, resolved: "dark" | "light") {
  const el = document.documentElement;
  el.classList.remove("faction-alliance", "faction-horde", "faction-neutral");
  el.classList.add(`faction-${faction}`);

  const colors = FACTION_COLORS[faction];
  if (colors) {
    const palette = colors[resolved];
    for (const [prop, value] of Object.entries(palette)) {
      el.style.setProperty(prop, value);
    }
  } else {
    for (const prop of FACTION_STYLE_PROPS) {
      el.style.removeProperty(prop);
    }
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [faction, setFactionState] = useState<Faction>("neutral");

  useEffect(() => {
    const storedTheme = localStorage.getItem("theme") as Theme | null;
    const t = storedTheme && ["dark", "light", "system"].includes(storedTheme) ? storedTheme : "dark";
    setThemeState(t);
    const resolved = resolveClass(t);
    applyClass(resolved);

    const storedFaction = localStorage.getItem("faction") as Faction | null;
    const f = storedFaction && ["alliance", "horde", "neutral"].includes(storedFaction) ? storedFaction : "neutral";
    setFactionState(f);
    applyFactionColors(f, resolved);
  }, []);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const resolved = resolveClass("system");
      applyClass(resolved);
      applyFactionColors(faction, resolved);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme, faction]);

  function setTheme(t: Theme) {
    setThemeState(t);
    localStorage.setItem("theme", t);
    const resolved = resolveClass(t);
    applyClass(resolved);
    applyFactionColors(faction, resolved);
  }

  function setFaction(f: Faction) {
    setFactionState(f);
    localStorage.setItem("faction", f);
    applyFactionColors(f, resolveClass(theme));
  }

  function previewFaction(f: Faction) {
    setFactionState(f);
    applyFactionColors(f, resolveClass(theme));
  }

  return (
    <ThemeCtx.Provider value={{ theme, setTheme, faction, setFaction, previewFaction }}>
      {children}
    </ThemeCtx.Provider>
  );
}
