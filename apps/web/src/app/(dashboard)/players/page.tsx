"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import {
  getClassName,
  getClassColor,
  getRaceName,
  getZoneName,
  getFaction,
} from "@/lib/wow-constants";
import { Users, RefreshCw } from "lucide-react";

interface OnlinePlayer {
  guid: number;
  name: string;
  level: number;
  class: number;
  race: number;
  gender: number;
  zone: number;
  map: number;
}

const REFRESH_INTERVAL = 30;

export default function PlayersPage() {
  const [players, setPlayers] = useState<OnlinePlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const lastFetchedAt = useRef<number>(Date.now());

  const fetchPlayers = useCallback((manual = false) => {
    if (manual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");
    api
      .get<OnlinePlayer[]>("/server/players")
      .then((data) => {
        setPlayers(data);
        lastFetchedAt.current = Date.now();
        setSecondsAgo(0);
      })
      .catch((e) => setError(e.message))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPlayers();
    }, REFRESH_INTERVAL * 1000);
    return () => clearInterval(interval);
  }, [fetchPlayers]);

  // Update "seconds ago" counter every second
  useEffect(() => {
    const ticker = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastFetchedAt.current) / 1000));
    }, 1000);
    return () => clearInterval(ticker);
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Online Players</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {players.length} player{players.length !== 1 ? "s" : ""} online
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Last updated: {secondsAgo}s ago
          </span>
          <button
            onClick={() => fetchPlayers(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground hover:bg-secondary disabled:opacity-50 transition-colors"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">
            Loading players...
          </p>
        </div>
      ) : players.length === 0 && !error ? (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-col items-center justify-center px-4 py-16">
            <Users className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-muted-foreground">No players online</p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Level
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Class
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Race
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Faction
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Zone
                </th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => {
                const faction = getFaction(player.race);
                return (
                  <tr
                    key={player.guid}
                    className="border-t border-border text-sm text-foreground hover:bg-secondary/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">{player.name}</td>
                    <td className="px-4 py-3">{player.level}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{
                            backgroundColor: getClassColor(player.class),
                          }}
                        />
                        <span
                          style={{ color: getClassColor(player.class) }}
                        >
                          {getClassName(player.class)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{getRaceName(player.race)}</td>
                    <td className="px-4 py-3">
                      {faction === "Alliance" ? (
                        <span className="inline-block rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-400">
                          Alliance
                        </span>
                      ) : faction === "Horde" ? (
                        <span className="inline-block rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">
                          Horde
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Unknown</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {getZoneName(player.zone)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
