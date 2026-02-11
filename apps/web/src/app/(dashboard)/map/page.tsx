"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { CONTINENT_MAPS } from "@repo/shared";
import { useMapPlayers } from "@/hooks/use-map-players";
import { Clock, RefreshCw } from "lucide-react";

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
  const [selectedMapId, setSelectedMapId] = useState(0);
  const { players, loading, secondsAgo } = useMapPlayers();

  const selectedConfig = useMemo(
    () => CONTINENT_MAPS.find((c) => c.id === selectedMapId) ?? CONTINENT_MAPS[0]!,
    [selectedMapId],
  );

  const filteredPlayers = useMemo(
    () => players.filter((p) => p.map === selectedMapId),
    [players, selectedMapId],
  );

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
        <WorldMap config={selectedConfig} players={filteredPlayers} />
      </div>
    </div>
  );
}
