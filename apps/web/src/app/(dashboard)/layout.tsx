"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { HealthBar } from "@/components/layout/health-bar";

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

  const togglePin = useCallback(() => {
    setPinned((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-pinned", String(next));
      return next;
    });
  }, []);

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
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      {/* Spacer — matches the sidebar's actual reserved width */}
      {!pinned && <div className="w-16 shrink-0" />}
      <div className="flex flex-1 flex-col overflow-hidden">
        <HealthBar />
        <main className="flex-1 overflow-y-auto px-6 py-4">
          {children}
        </main>
      </div>
    </div>
  );
}
