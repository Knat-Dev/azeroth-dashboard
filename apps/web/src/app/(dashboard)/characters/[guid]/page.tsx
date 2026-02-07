"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { formatGold, formatPlaytime } from "@/lib/utils";

const WOW_CLASSES: Record<number, { name: string; color: string }> = {
  1: { name: "Warrior", color: "#C79C6E" }, 2: { name: "Paladin", color: "#F58CBA" },
  3: { name: "Hunter", color: "#ABD473" }, 4: { name: "Rogue", color: "#FFF569" },
  5: { name: "Priest", color: "#FFFFFF" }, 6: { name: "Death Knight", color: "#C41F3B" },
  7: { name: "Shaman", color: "#0070DE" }, 8: { name: "Mage", color: "#69CCF0" },
  9: { name: "Warlock", color: "#9482C9" }, 11: { name: "Druid", color: "#FF7D0A" },
};

const WOW_RACES: Record<number, string> = {
  1: "Human", 2: "Orc", 3: "Dwarf", 4: "Night Elf", 5: "Undead",
  6: "Tauren", 7: "Gnome", 8: "Troll", 10: "Blood Elf", 11: "Draenei",
};

interface CharacterDetail {
  guid: number; name: string; race: number; class: number; gender: number;
  level: number; money: number; online: number; totaltime: number;
  health: number; power1: number; totalKills: number;
  arenaPoints: number; totalHonorPoints: number;
}

export default function CharacterDetailPage() {
  const params = useParams();
  const [char, setChar] = useState<CharacterDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (params.guid) {
      api
        .get<CharacterDetail>(`/characters/${params.guid}`)
        .then(setChar)
        .catch((e) => setError(e.message));
    }
  }, [params.guid]);

  if (error) return <div className="text-destructive">{error}</div>;
  if (!char) return <div className="text-muted-foreground">Loading...</div>;

  const cls = WOW_CLASSES[char.class];

  return (
    <div>
      <div className="mb-6">
        <h1
          className="text-3xl font-bold"
          style={{ color: cls?.color ?? "#fff" }}
        >
          {char.name}
        </h1>
        <p className="text-muted-foreground">
          Level {char.level} {WOW_RACES[char.race]} {cls?.name}
          {char.gender === 0 ? " (Male)" : " (Female)"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Health", value: char.health.toLocaleString() },
          { label: "Mana/Power", value: char.power1.toLocaleString() },
          { label: "Gold", value: formatGold(char.money) },
          { label: "Playtime", value: formatPlaytime(char.totaltime) },
          { label: "Total Kills", value: char.totalKills.toLocaleString() },
          { label: "Honor Points", value: char.totalHonorPoints.toLocaleString() },
          { label: "Arena Points", value: char.arenaPoints.toLocaleString() },
          { label: "Status", value: char.online ? "Online" : "Offline" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-card p-4"
          >
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="text-lg font-semibold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
