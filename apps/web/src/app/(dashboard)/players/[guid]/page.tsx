"use client";

import { ItemTooltip } from "@/components/items/item-tooltip";
import { api } from "@/lib/api";
import { formatGold, formatPlaytime } from "@/lib/utils";
import {
  getClassColor,
  getClassName,
  getFaction,
  getItemQualityColor,
  getRaceName,
  getZoneName,
} from "@/lib/wow-constants";
import type { EquippedItemSlot, PlayerDetail } from "@repo/shared";
import { ArrowLeft, Clock, Coins, Heart, Info, MapPin, Shield, Swords, Trophy, Users } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const EQUIPMENT_SLOTS: Record<number, string> = {
  0: "Head", 1: "Neck", 2: "Shoulders", 3: "Shirt", 4: "Chest",
  5: "Waist", 6: "Legs", 7: "Feet", 8: "Wrists", 9: "Hands",
  10: "Ring 1", 11: "Ring 2", 12: "Trinket 1", 13: "Trinket 2",
  14: "Back", 15: "Main Hand", 16: "Off Hand", 17: "Ranged", 18: "Tabard",
};

// WoW character screen layout
const LEFT_SLOTS = [0, 1, 2, 14, 4, 3, 18, 8];   // Head, Neck, Shoulders, Back, Chest, Shirt, Tabard, Wrists
const RIGHT_SLOTS = [9, 5, 6, 7, 10, 11, 12, 13]; // Hands, Waist, Legs, Feet, Ring1, Ring2, Trinket1, Trinket2
const BOTTOM_SLOTS = [15, 16, 17];                  // Main Hand, Off Hand, Ranged

export default function PlayerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [player, setPlayer] = useState<PlayerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [equipment, setEquipment] = useState<EquippedItemSlot[]>([]);

  useEffect(() => {
    const id = params.guid;
    if (!id) return;

    api
      .get<PlayerDetail>(`/server/players/${id}`)
      .then((p) => {
        setPlayer(p);
        // Use resolved numeric guid for equipment call
        api
          .get<EquippedItemSlot[]>(
            `/server/players/${p.guid}/equipment?level=${p.level}`
          )
          .then((slots) => setEquipment(slots))
          .catch(() => {});
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.guid]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Players
        </button>
        <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error || "Player not found"}
        </div>
      </div>
    );
  }

  const faction = getFaction(player.race);
  const hasEquipment = equipment.some((s) => s.item !== null);

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Players
      </button>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <span
            className={`inline-block h-3 w-3 rounded-full ${player.online === 1 ? "bg-green-500" : "bg-muted-foreground/40"}`}
          />
          <h1 className="text-2xl font-bold" style={{ color: getClassColor(player.class) }}>
            {player.name}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-foreground">
            Level {player.level}
          </span>
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-foreground">
            {getRaceName(player.race)}
          </span>
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium" style={{ color: getClassColor(player.class) }}>
            {getClassName(player.class)}
          </span>
          {faction === "Alliance" ? (
            <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-400">
              Alliance
            </span>
          ) : faction === "Horde" ? (
            <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">
              Horde
            </span>
          ) : null}
          {player.online === 1 && (
            <span className="rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-400">
              Online
            </span>
          )}
          {player.guildName && (
            <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              <Users className="h-3 w-3" />
              &lt;{player.guildName}&gt;
            </span>
          )}
        </div>
      </div>

      {/* Info row */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Character Info
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Play Time
              </span>
              <span className="text-foreground">{formatPlaytime(player.totaltime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Coins className="h-3.5 w-3.5" />
                Gold
              </span>
              <span className="text-foreground">{formatGold(player.money)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Arena Points</span>
              <span className="text-foreground">{player.arenaPoints}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Account ID</span>
              <span className="font-mono text-foreground">#{player.account}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Location
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                Zone
              </span>
              <span className="text-foreground">{getZoneName(player.zone)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Map</span>
              <span className="text-foreground">{player.map}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Position</span>
              <span className="font-mono text-xs text-foreground">
                {player.positionX.toFixed(1)}, {player.positionY.toFixed(1)}, {player.positionZ.toFixed(1)}
              </span>
            </div>
            {player.guildName && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Guild</span>
                  <span className="text-foreground">{player.guildName}</span>
                </div>
                {player.guildRank !== null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Guild Rank</span>
                    <span className="text-foreground">{player.guildRank}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stats + Equipment side by side */}
      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        {/* Left: Stats */}
        <div className="flex flex-col gap-3">
          <div className="flex-1 flex flex-col justify-center rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Heart className="h-3.5 w-3.5 text-red-400" />
              Health
            </div>
            <p className="mt-1 text-lg font-bold text-foreground">{player.health.toLocaleString()}</p>
          </div>
          <div className="flex-1 flex flex-col justify-center rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-3.5 w-3.5 text-blue-400" />
              Power
            </div>
            <p className="mt-1 text-lg font-bold text-foreground">{player.power1.toLocaleString()}</p>
          </div>
          <div className="flex-1 flex flex-col justify-center rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Swords className="h-3.5 w-3.5 text-orange-400" />
              Total Kills
            </div>
            <p className="mt-1 text-lg font-bold text-foreground">{player.totalKills.toLocaleString()}</p>
          </div>
          <div className="flex-1 flex flex-col justify-center rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Trophy className="h-3.5 w-3.5 text-yellow-400" />
              Honor Points
            </div>
            <p className="mt-1 text-lg font-bold text-foreground">{player.totalHonorPoints.toLocaleString()}</p>
          </div>
        </div>

        {/* Right: Equipment */}
        {hasEquipment && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Equipment
            </h3>
            {player.online === 1 && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                <Info className="h-3 w-3" />
                Updates on logout or server save
              </span>
            )}
          </div>
          {(() => {
            const slotMap = new Map(equipment.map((s) => [s.slot, s]));
            const renderSlot = (slotIdx: number) => {
              const slot = slotMap.get(slotIdx);
              const item = slot?.item ?? null;
              const label = EQUIPMENT_SLOTS[slotIdx] ?? `Slot ${slotIdx}`;
              return item ? (
                <ItemTooltip key={slotIdx} item={item}>
                  {(anchorRef) => (
                    <div className="py-1">
                      <div className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/30 px-3 py-2 text-sm hover:bg-secondary/50 transition-colors cursor-default">
                        <span className="text-muted-foreground">{label}</span>
                        <span
                          ref={anchorRef}
                          className="truncate ml-2 text-xs font-medium"
                          style={{ color: getItemQualityColor(item.quality) }}
                        >
                          {item.name}
                        </span>
                      </div>
                    </div>
                  )}
                </ItemTooltip>
              ) : (
                <div key={slotIdx} className="py-1">
                  <div className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/30 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="text-muted-foreground/50">Empty</span>
                  </div>
                </div>
              );
            };
            return (
              <>
                <div className="-my-1 grid sm:grid-cols-2">
                  <div className="flex flex-col">
                    {LEFT_SLOTS.map(renderSlot)}
                  </div>
                  <div className="flex flex-col">
                    {RIGHT_SLOTS.map(renderSlot)}
                  </div>
                </div>
                <div className="-my-1 mt-1 grid grid-cols-1 sm:grid-cols-3">
                  {BOTTOM_SLOTS.map(renderSlot)}
                </div>
              </>
            );
          })()}
        </div>
        )}
      </div>
    </div>
  );
}
