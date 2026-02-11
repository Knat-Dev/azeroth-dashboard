"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { useRouter } from "next/navigation";
import * as L from "leaflet";
import { WOW_CLASSES, WOW_RACES, getZoneName } from "@repo/shared";
import type { MapPlayer } from "@repo/shared";

export interface PlayerMarkerData {
  player: MapPlayer;
  pixelX: number;
  pixelY: number;
}

/**
 * Renders all player markers on a single Leaflet Canvas layer.
 * Avoids 500+ React components / SVG DOM nodes — everything is drawn
 * on one <canvas>, with tooltips created lazily on hover.
 */
export function PlayersLayer({ markers }: { markers: PlayerMarkerData[] }) {
  const map = useMap();
  const router = useRouter();
  const groupRef = useRef<L.LayerGroup | null>(null);
  const rendererRef = useRef<L.Canvas | null>(null);

  // Create canvas renderer + layer group once per map mount
  useEffect(() => {
    const renderer = L.canvas({ padding: 0.5 });
    const group = L.layerGroup().addTo(map);
    rendererRef.current = renderer;
    groupRef.current = group;
    return () => {
      group.remove();
    };
  }, [map]);

  // Rebuild markers when data changes
  useEffect(() => {
    const group = groupRef.current;
    const renderer = rendererRef.current;
    if (!group || !renderer) return;

    group.clearLayers();

    for (const m of markers) {
      const color = WOW_CLASSES[m.player.class]?.color ?? "#FFFFFF";
      const dot = L.circleMarker([m.pixelY, m.pixelX], {
        renderer,
        radius: 5,
        color,
        fillColor: color,
        fillOpacity: 0.9,
        weight: 1.5,
        opacity: 1,
      });

      dot.on("mouseover", () => {
        const raceInfo = WOW_RACES[m.player.race];
        const classInfo = WOW_CLASSES[m.player.class];
        dot
          .bindTooltip(
            `<div style="font-size:12px;line-height:1.6">` +
              `<div style="font-weight:600;color:${color}">${m.player.name}</div>` +
              `<div>Level ${m.player.level} ${raceInfo?.name ?? "Unknown"} ${classInfo?.name ?? "Unknown"}</div>` +
              `<div style="color:#9ca3af">${getZoneName(m.player.zone)}</div>` +
              `</div>`,
            { direction: "top", offset: [0, -8], opacity: 0.95 },
          )
          .openTooltip();
      });

      dot.on("mouseout", () => {
        dot.unbindTooltip();
      });

      dot.on("click", () => {
        router.push(`/players/${m.player.guid}`);
      });

      group.addLayer(dot);
    }
  }, [markers, router]);

  return null;
}
