"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { HealthBar } from "@/components/layout/health-bar";
import { API_URL } from "@/lib/api";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [pinned, setPinned] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebar-pinned") === "true";
    }
    return false;
  });
  const [hovered, setHovered] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    hoverTimer.current = setTimeout(() => setHovered(true), 200);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    setHovered(false);
  }, []);

  const togglePin = useCallback(() => {
    setPinned((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-pinned", String(next));
      return next;
    });
  }, []);

  // Check if first-run setup is needed before checking auth
  useEffect(() => {
    const cached = sessionStorage.getItem("setupComplete");
    if (cached === "true") return;

    fetch(`${API_URL}/setup/status`)
      .then((r) => r.json())
      .then((data) => {
        if (data.needsSetup) {
          router.push("/setup");
        } else {
          sessionStorage.setItem("setupComplete", "true");
        }
      })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  const expanded = pinned || hovered;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        expanded={expanded}
        pinned={pinned}
        onTogglePin={togglePin}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      {/* Spacer — matches the sidebar's actual reserved width */}
      {!pinned && <div className="hidden md:block w-16 shrink-0" />}
      <div className="flex flex-1 flex-col overflow-hidden">
        <HealthBar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto px-4 py-3 md:px-6 md:py-4">
          {children}
        </main>
      </div>
    </div>
  );
}
