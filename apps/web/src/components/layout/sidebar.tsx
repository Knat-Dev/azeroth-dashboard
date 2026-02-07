"use client";

import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/providers/theme-provider";
import {
  Activity,
  Ban,
  Database,
  Home,
  LogOut,
  Monitor,
  Moon,
  Pin,
  PinOff,
  Settings,
  Sun,
  Terminal,
  UserCog,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const opsItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/players", label: "Players", icon: Users },
  { href: "/console", label: "Console", icon: Terminal },
  { href: "/backups", label: "Backups", icon: Database },
];

const mgmtItems = [
  { href: "/accounts", label: "Accounts", icon: UserCog },
  { href: "/bans", label: "Bans", icon: Ban },
];

const systemItems = [
  { href: "/events", label: "Events", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

const fadeText = (expanded: boolean) =>
  cn("whitespace-nowrap transition-opacity duration-200 opacity-100", expanded ? "md:opacity-100" : "md:opacity-0");

function NavSection({
  label,
  items,
  pathname,
  expanded,
  onLinkClick,
}: {
  label: string;
  items: { href: string; label: string; icon: typeof Home }[];
  pathname: string;
  expanded: boolean;
  onLinkClick?: () => void;
}) {
  return (
    <div className="mb-3">
      <div className="mb-1.5 px-4 flex items-center h-4 relative">
        <p className={cn(
          "text-xs font-medium uppercase tracking-wider text-muted-foreground transition-opacity duration-200 absolute inset-x-4 opacity-100",
          expanded ? "md:opacity-100" : "md:opacity-0",
        )}>
          {label}
        </p>
        <div className={cn(
          "w-full border-t border-border transition-opacity duration-200 opacity-0",
          expanded ? "md:opacity-0" : "md:opacity-100",
        )} />
      </div>
      <div className="space-y-0.5">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            title={!expanded ? item.label : undefined}
            onClick={onLinkClick}
            className={cn(
              "flex items-center gap-3 rounded-lg px-4 py-2 text-sm transition-colors",
              pathname === item.href
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className={fadeText(expanded)}>{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

const themeOptions = [
  { value: "dark" as const, icon: Moon, label: "Dark" },
  { value: "light" as const, icon: Sun, label: "Light" },
  { value: "system" as const, icon: Monitor, label: "System" },
];

function ThemeToggle({ expanded }: { expanded: boolean }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className="border-t border-border px-2 py-2">
      <div className={cn(
        "flex items-center rounded-lg",
        expanded ? "justify-center gap-1 px-1" : "flex-col gap-1 md:flex-col",
      )}>
        {themeOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            title={opt.label}
            className={cn(
              "rounded-md p-1.5 transition-colors",
              theme === opt.value
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <opt.icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
    </div>
  );
}

export function Sidebar({
  expanded,
  pinned,
  onTogglePin,
  onMouseEnter,
  onMouseLeave,
  mobileOpen,
  onMobileClose,
}: {
  expanded: boolean;
  pinned: boolean;
  onTogglePin: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [userMenuOpen]);

  // Close user menu when sidebar collapses
  useEffect(() => {
    if (!expanded) setUserMenuOpen(false);
  }, [expanded]);

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={cn(
          "flex h-screen flex-col overflow-hidden bg-card border-r border-border transition-all duration-200 z-50",
          // Mobile: fixed drawer with translate
          "fixed inset-y-0 left-0 w-56",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop: override mobile positioning
          "md:translate-x-0",
          pinned ? "md:relative" : "md:fixed md:left-0 md:top-0",
          pinned || "md:z-40",
          expanded ? "md:w-56" : "md:w-16",
        )}
      >
        {/* Logo + Pin */}
        <div className="relative flex items-center border-b border-border px-4 py-4">
          <div className="h-8 w-8 shrink-0 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">AC</span>
          </div>
          <div className={cn("ml-2 min-w-0", "opacity-100 md:opacity-100", !expanded && "md:opacity-0", "whitespace-nowrap transition-opacity duration-200")}>
            <h1 className="text-sm font-semibold text-foreground">Azeroth Dashboard</h1>
            <p className="text-xs text-muted-foreground">WoTLK 3.3.5a</p>
          </div>
          <button
            onClick={onTogglePin}
            title={pinned ? "Unpin sidebar" : "Pin sidebar"}
            className={cn(
              "absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-all duration-200",
              "hidden md:block",
              expanded ? "md:opacity-100" : "md:opacity-0 md:pointer-events-none",
            )}
          >
            {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-4">
          <NavSection label="Operations" items={opsItems} pathname={pathname} expanded={expanded} onLinkClick={onMobileClose} />
          <NavSection label="Management" items={mgmtItems} pathname={pathname} expanded={expanded} onLinkClick={onMobileClose} />
          <NavSection label="System" items={systemItems} pathname={pathname} expanded={expanded} onLinkClick={onMobileClose} />
        </nav>

        {/* Theme toggle */}
        <ThemeToggle expanded={expanded} />

        {/* Bottom: User */}
        <div className="border-t border-border px-2 py-3">
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex w-full items-center gap-3 rounded-lg px-4 py-2 transition-colors hover:bg-secondary"
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary">
                {(user?.username ?? "A")[0]?.toUpperCase()}
              </div>
              <span className={cn("truncate text-sm font-medium text-foreground", "opacity-100 md:opacity-100", !expanded && "md:opacity-0", "whitespace-nowrap transition-opacity duration-200")}>
                {user?.username ?? "Admin"}
              </span>
            </button>

            {/* Popup menu */}
            {userMenuOpen && (
              <div className={cn(
                "absolute z-50 rounded-lg border border-border bg-card py-1 shadow-lg",
                expanded
                  ? "bottom-full left-0 mb-1 w-full"
                  : "bottom-0 left-full ml-2 w-40",
              )}>
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-sm font-medium text-foreground">{user?.username ?? "Admin"}</p>
                  <p className="text-xs text-muted-foreground">Administrator</p>
                </div>
                <button
                  onClick={() => { setUserMenuOpen(false); logout(); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
