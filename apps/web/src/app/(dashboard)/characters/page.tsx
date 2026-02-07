"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { WOW_CLASSES, WOW_RACES } from "@/lib/constants";
import { formatGold, formatPlaytime } from "@/lib/utils";
import { Swords } from "lucide-react";

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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">My Characters</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {loading ? "Loading..." : `${characters.length} character${characters.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : characters.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16">
          <Swords className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-muted-foreground">No characters found on this account.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {characters.map((char) => {
            const cls = WOW_CLASSES[char.class];
            return (
              <Link
                key={char.guid}
                href={`/characters/${char.guid}`}
                className="group rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/50 hover:shadow-[0_0_15px_rgba(245,166,35,0.1)]"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3
                    className="text-lg font-bold"
                    style={{ color: cls?.color ?? "#fff" }}
                  >
                    {char.name}
                  </h3>
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-sm font-mono font-medium text-primary">
                    {char.level}
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
                  <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
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
