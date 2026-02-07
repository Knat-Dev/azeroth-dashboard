"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import {
  Home,
  Terminal,
  Database,
  Users,
  UserCog,
  Ban,
  Settings,
  LogOut,
} from "lucide-react";

const opsItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/console", label: "Console", icon: Terminal },
  { href: "/backups", label: "Backups", icon: Database },
];

const mgmtItems = [
  { href: "/accounts", label: "Accounts", icon: UserCog },
  { href: "/bans", label: "Bans", icon: Ban },
];

const systemItems = [
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavSection({
  label,
  items,
  pathname,
}: {
  label: string;
  items: { href: string; label: string; icon: typeof Home }[];
  pathname: string;
}) {
  return (
    <div className="mb-6">
      <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="space-y-1">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              pathname === item.href
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="flex h-screen w-64 flex-col bg-card border-r border-border">
      <div className="flex items-center gap-2 border-b border-border px-6 py-4">
        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-sm">A</span>
        </div>
        <div>
          <h1 className="text-sm font-semibold text-foreground">Azeroth Dashboard</h1>
          <p className="text-xs text-muted-foreground">WoTLK 3.3.5a</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <NavSection label="Operations" items={opsItems} pathname={pathname} />
        <NavSection label="Management" items={mgmtItems} pathname={pathname} />
        <NavSection label="System" items={systemItems} pathname={pathname} />
      </nav>

      <div className="border-t border-border px-3 py-4">
        <div className="flex items-center justify-between px-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              {user?.username ?? "Admin"}
            </p>
            <p className="text-xs text-muted-foreground">Administrator</p>
          </div>
          <button
            onClick={logout}
            className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
