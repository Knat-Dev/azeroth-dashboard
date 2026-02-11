"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import { CONTINENT_MAPS } from "@repo/shared";
import { useMapPlayers } from "@/hooks/use-map-players";
import { Clock, RefreshCw, Search, X } from "lucide-react";

const WorldMap = dynamic(
  () => import("@/components/map/world-map").then((m) => m.WorldMap),
  { ssr: false, loading: () => <MapSkeleton /> },
);

function MapSkeleton() {
  return (
    <div className="flex h-full items-center justify-center rounded-lg bg-card">
      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function MapPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedMapId, setSelectedMapId] = useState(0);
  const [search, setSearch] = useState("");
  const { players, loading, secondsAgo } = useMapPlayers();
  const focusConsumed = useRef(false);

  // Handle ?focus=GUID param on mount once players are loaded
  const focusParam = searchParams.get("focus");
  useEffect(() => {
    if (!focusParam || focusConsumed.current || players.length === 0) return;
    const guid = Number(focusParam);
    if (Number.isNaN(guid)) return;
    const player = players.find((p) => p.guid === guid);
    if (player) {
      setSearch(player.name);
      setSelectedMapId(player.map);
    }
    focusConsumed.current = true;
    router.replace("/map", { scroll: false });
  }, [focusParam, players, router]);

  const selectedConfig = useMemo(
    () => CONTINENT_MAPS.find((c) => c.id === selectedMapId) ?? CONTINENT_MAPS[0]!,
    [selectedMapId],
  );

  const filteredPlayers = useMemo(
    () => players.filter((p) => p.map === selectedMapId),
    [players, selectedMapId],
  );

  // Search: compute highlighted guids across all continents
  const searchLower = search.toLowerCase().trim();
  const allMatches = useMemo(
    () => (searchLower ? players.filter((p) => p.name.toLowerCase().includes(searchLower)) : []),
    [players, searchLower],
  );

  const highlightGuids = useMemo(
    () => (allMatches.length > 0 ? new Set(allMatches.map((p) => p.guid)) : undefined),
    [allMatches],
  );

  // Auto-switch continent if exactly 1 match and they're on a different continent
  const prevAutoSwitch = useRef<string>("");
  useEffect(() => {
    if (allMatches.length !== 1) {
      prevAutoSwitch.current = "";
      return;
    }
    const match = allMatches[0]!;
    const key = `${match.guid}-${searchLower}`;
    if (key === prevAutoSwitch.current) return;
    if (match.map !== selectedMapId) {
      prevAutoSwitch.current = key;
      setSelectedMapId(match.map);
    }
  }, [allMatches, searchLower, selectedMapId]);

  // focusGuid: if exactly 1 match on current continent, focus on them
  const focusGuid = useMemo(() => {
    const matchesOnContinent = allMatches.filter((p) => p.map === selectedMapId);
    return matchesOnContinent.length === 1 ? matchesOnContinent[0]!.guid : undefined;
  }, [allMatches, selectedMapId]);

  const clearSearch = useCallback(() => setSearch(""), []);

  // Count players per continent
  const counts = useMemo(() => {
    const map = new Map<number, number>();
    for (const c of CONTINENT_MAPS) map.set(c.id, 0);
    for (const p of players) {
      const curr = map.get(p.map);
      if (curr !== undefined) map.set(p.map, curr + 1);
    }
    return map;
  }, [players]);

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground">World Map</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live player positions across Azeroth
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search player..."
              className="h-8 w-44 rounded-lg border border-border bg-secondary/50 pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {search && (
              <button
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>
              {loading ? "Loading..." : `Updated ${secondsAgo}s ago`}
            </span>
            <span className="text-foreground font-medium">
              {filteredPlayers.length} player{filteredPlayers.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Continent tabs */}
      <div className="flex gap-1.5 shrink-0 overflow-x-auto">
        {CONTINENT_MAPS.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedMapId(c.id)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
              selectedMapId === c.id
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            {c.name}
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                selectedMapId === c.id
                  ? "bg-primary/20 text-primary"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {counts.get(c.id) ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Map */}
      <div className="flex-1 min-h-0 rounded-xl glass overflow-hidden">
        <WorldMap
          config={selectedConfig}
          players={filteredPlayers}
          focusGuid={focusGuid}
          highlightGuids={highlightGuids}
        />
      </div>
    </div>
  );
}
