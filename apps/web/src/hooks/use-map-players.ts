"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import type { MapPlayer, MapPlayersResponse } from "@repo/shared";

const POLL_INTERVAL = 5000;

export function useMapPlayers() {
  const [players, setPlayers] = useState<MapPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const lastFetchedAt = useRef(Date.now());
  const [secondsAgo, setSecondsAgo] = useState(0);

  const fetchPlayers = useCallback(() => {
    api
      .get<MapPlayersResponse>("/server/map/players")
      .then((res) => {
        setPlayers(res.players);
        lastFetchedAt.current = Date.now();
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void fetchPlayers();
    const i = setInterval(fetchPlayers, POLL_INTERVAL);
    return () => clearInterval(i);
  }, [fetchPlayers]);

  useEffect(() => {
    const i = setInterval(
      () => setSecondsAgo(Math.floor((Date.now() - lastFetchedAt.current) / 1000)),
      1000,
    );
    return () => clearInterval(i);
  }, []);

  return { players, loading, secondsAgo };
}
