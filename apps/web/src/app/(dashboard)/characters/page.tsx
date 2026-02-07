"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatGold, formatPlaytime } from "@/lib/utils";

const WOW_CLASSES: Record<number, { name: string; color: string }> = {
  1: { name: "Warrior", color: "#C79C6E" },
  2: { name: "Paladin", color: "#F58CBA" },
  3: { name: "Hunter", color: "#ABD473" },
  4: { name: "Rogue", color: "#FFF569" },
  5: { name: "Priest", color: "#FFFFFF" },
  6: { name: "Death Knight", color: "#C41F3B" },
  7: { name: "Shaman", color: "#0070DE" },
  8: { name: "Mage", color: "#69CCF0" },
  9: { name: "Warlock", color: "#9482C9" },
  11: { name: "Druid", color: "#FF7D0A" },
};

const WOW_RACES: Record<number, string> = {
  1: "Human", 2: "Orc", 3: "Dwarf", 4: "Night Elf", 5: "Undead",
  6: "Tauren", 7: "Gnome", 8: "Troll", 10: "Blood Elf", 11: "Draenei",
};

interface Character {
  guid: number;
  name: string;
  race: number;
  class: number;
  level: number;
  money: number;
  online: number;
  totaltime: number;
  totalKills: number;
}

export default function CharactersPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Character[]>("/characters")
      .then(setCharacters)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-muted-foreground">Loading characters...</div>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">My Characters</h1>

      {characters.length === 0 ? (
        <p className="text-muted-foreground">No characters found on this account.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {characters.map((char) => {
            const cls = WOW_CLASSES[char.class];
            return (
              <Link
                key={char.guid}
                href={`/characters/${char.guid}`}
                className="rounded-xl border border-border bg-card p-5 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3
                    className="text-lg font-bold"
                    style={{ color: cls?.color ?? "#fff" }}
                  >
                    {char.name}
                  </h3>
                  <span className="text-sm font-mono text-primary">
                    Lv {char.level}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {WOW_RACES[char.race]} {cls?.name}
                </p>
                <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                  <span>{formatGold(char.money)}</span>
                  <span>{formatPlaytime(char.totaltime)}</span>
                  <span>{char.totalKills} HKs</span>
                </div>
                {char.online === 1 && (
                  <span className="mt-2 inline-block rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-400">
                    Online
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
