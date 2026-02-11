"use client";

import { useMemo, useEffect, useState, useCallback, useRef } from "react";
import {
  MapContainer,
  ImageOverlay,
  Marker,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import * as L from "leaflet";
import { CRS, LatLngBounds } from "leaflet";
import type { LeafletMouseEvent } from "leaflet";
import { gameToMapPixel, pixelToMapPercent, MAP_CITIES, MAP_FRAME_WIDTH, MAP_FRAME_HEIGHT } from "@repo/shared";
import type { ContinentMapConfig, MapPlayer } from "@repo/shared";
import { PlayersLayer } from "./player-marker";

import "leaflet/dist/leaflet.css";

interface WorldMapProps {
  config: ContinentMapConfig;
  players: MapPlayer[];
  focusGuid?: number;
  highlightGuids?: Set<number>;
}

/** WoW uses a single icon per POI type — no faction coloring (verified from AreaPOI.dbc). */
const townIcon = L.icon({
  iconUrl: '/maps/icons/town.png',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const cityIcon = L.icon({
  iconUrl: '/maps/icons/city.png',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

/** Constrains the map so the image always fills the viewport — no edge peeking. */
function BoundsEnforcer({ bounds }: { bounds: LatLngBounds }) {
  const map = useMap();

  useEffect(() => {
    function enforce() {
      // `inside = true` → zoom where the view fits INSIDE the bounds,
      // so the image always covers the full viewport (no background gaps).
      const minZoom = map.getBoundsZoom(bounds, true);
      map.setMinZoom(minZoom);
      // Re-apply maxBounds after minZoom change so Leaflet recalculates constraints
      map.setMaxBounds(bounds);
      if (map.getZoom() < minZoom) {
        map.setZoom(minZoom);
      }
      map.panInsideBounds(bounds, { animate: false });
    }

    enforce();
    map.on("resize", enforce);
    map.on("zoomend", () => map.panInsideBounds(bounds, { animate: false }));
    return () => {
      map.off("resize", enforce);
      map.off("zoomend");
    };
  }, [map, bounds]);

  return null;
}

/** Tracks mouse position and reports WoW-style map percentages. */
function CoordinateTracker({
  imageHeight,
  onMove,
  onOut,
}: {
  imageHeight: number;
  onMove: (x: number, y: number) => void;
  onOut: () => void;
}) {
  useMapEvents({
    mousemove(e: LeafletMouseEvent) {
      // Convert Leaflet coords back to image pixel coords
      const pixelX = e.latlng.lng;
      const pixelY = imageHeight - e.latlng.lat;
      const pct = pixelToMapPercent(pixelX, pixelY);
      onMove(pct.x, pct.y);
    },
    mouseout() {
      onOut();
    },
  });
  return null;
}

/** Flies to the focused player's position when focusGuid changes. */
function MapFocuser({
  focusGuid,
  markers,
}: {
  focusGuid: number | undefined;
  markers: { player: MapPlayer; pixelX: number; pixelY: number }[];
}) {
  const map = useMap();
  const lastFocused = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (focusGuid === undefined || focusGuid === lastFocused.current) return;
    const match = markers.find((m) => m.player.guid === focusGuid);
    if (!match) return;
    lastFocused.current = focusGuid;
    map.flyTo([match.pixelY, match.pixelX], 3, { duration: 0.8 });
  }, [focusGuid, markers, map]);

  return null;
}

export function WorldMap({ config, players, focusGuid, highlightGuids }: WorldMapProps) {
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);

  // Full image bounds for the overlay (1024x768)
  const imageBounds = useMemo(
    () => new LatLngBounds([0, 0], [config.imageHeight, config.imageWidth]),
    [config.imageHeight, config.imageWidth],
  );

  // Content-area bounds for viewport constraints (1002x668).
  // DBC coordinates map to the 1002x668 WorldMapDetailFrame anchored at image top-left.
  // In Leaflet CRS.Simple: lat = imageHeight - pixelY, lng = pixelX.
  // Content top-left:     pixel (0, 0)    → Leaflet (768, 0)
  // Content bottom-right: pixel (1002, 668) → Leaflet (768-668=100, 1002)
  const contentBounds = useMemo(
    () => new LatLngBounds(
      [config.imageHeight - MAP_FRAME_HEIGHT, 0],
      [config.imageHeight, MAP_FRAME_WIDTH],
    ),
    [config.imageHeight],
  );

  const handleMove = useCallback((x: number, y: number) => {
    setCoords({ x, y });
  }, []);

  const handleOut = useCallback(() => {
    setCoords(null);
  }, []);

  const markers = useMemo(
    () =>
      players.map((p) => {
        const px = gameToMapPixel(config, p.positionX, p.positionY);
        return {
          player: p,
          pixelX: px.x,
          pixelY: config.imageHeight - px.y,
        };
      }),
    [players, config],
  );

  const cities = useMemo(() => {
    const continentCities = MAP_CITIES.filter((c) => c.mapId === config.id);
    return continentCities.map((city) => {
      const px = gameToMapPixel(config, city.gameX, city.gameY);
      return {
        city,
        lat: config.imageHeight - px.y,
        lng: px.x,
      };
    });
  }, [config]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg [&_.leaflet-container]:bg-[#0a0e17] [&_.leaflet-control-zoom_a]:bg-card [&_.leaflet-control-zoom_a]:text-foreground [&_.leaflet-control-zoom_a]:border-border">
      {/* key forces full re-mount when switching continents */}
      <MapContainer
        key={config.key}
        crs={CRS.Simple}
        bounds={contentBounds}
        maxBounds={contentBounds}
        maxBoundsViscosity={1.0}
        minZoom={0}
        maxZoom={4}
        zoomSnap={0.25}
        zoomDelta={0.5}
        attributionControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <BoundsEnforcer bounds={contentBounds} />
        <CoordinateTracker
          imageHeight={config.imageHeight}
          onMove={handleMove}
          onOut={handleOut}
        />
        <ImageOverlay url={`/maps/${config.key}.png`} bounds={imageBounds} />
        {cities.map((c) => (
          <Marker
            key={c.city.name}
            position={[c.lat, c.lng]}
            icon={c.city.type === 'city' ? cityIcon : townIcon}
          >
            <Tooltip
              direction="top"
              offset={[0, c.city.type === 'city' ? -16 : -14]}
              opacity={0.95}
            >
              <span className="text-xs font-semibold">{c.city.name}</span>
            </Tooltip>
          </Marker>
        ))}
        <PlayersLayer markers={markers} highlightGuids={highlightGuids} />
        <MapFocuser focusGuid={focusGuid} markers={markers} />
      </MapContainer>
      {/* WoW-style coordinate display */}
      {coords && coords.x >= 0 && coords.x <= 100 && coords.y >= 0 && coords.y <= 100 && (
        <div className="absolute bottom-3 left-3 z-[1000] rounded bg-black/70 px-2.5 py-1 font-mono text-xs text-amber-300/90">
          {coords.x.toFixed(1)}, {coords.y.toFixed(1)}
        </div>
      )}
    </div>
  );
}
