"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { WOW_CLASSES, WOW_RACES, getFaction } from "@/lib/constants";
import { formatGold, formatPlaytime } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

interface CharacterDetail {
  guid: number;
  name: string;
  race: number;
  class: number;
  gender: number;
  level: number;
  money: number;
  online: number;
  totaltime: number;
  health: number;
  power1: number;
  totalKills: number;
  arenaPoints: number;
  totalHonorPoints: number;
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

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-6 py-4 text-sm text-destructive">
          {error}
        </div>
      </div>
    );
  }

  if (!char) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const cls = WOW_CLASSES[char.class];
  const faction = getFaction(char.race);

  return (
    <div>
      <Link
        href="/characters"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to characters
      </Link>

      <div className="mb-6 flex items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1
              className="text-3xl font-bold"
              style={{ color: cls?.color ?? "#fff" }}
            >
              {char.name}
            </h1>
            {char.online === 1 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-400">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                Online
              </span>
            )}
          </div>
          <p className="mt-1 text-muted-foreground">
            Level {char.level} {WOW_RACES[char.race]} {cls?.name}
            {char.gender === 0 ? " (Male)" : " (Female)"}
            <span className="ml-2 text-xs" style={{ color: faction === "Alliance" ? "#0078FF" : "#B30000" }}>
              {faction}
            </span>
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Health", value: char.health.toLocaleString(), color: "text-green-400" },
          { label: "Mana/Power", value: char.power1.toLocaleString(), color: "text-accent" },
          { label: "Gold", value: formatGold(char.money), color: "text-primary" },
          { label: "Playtime", value: formatPlaytime(char.totaltime), color: "text-foreground" },
          { label: "Total Kills", value: char.totalKills.toLocaleString(), color: "text-destructive" },
          { label: "Honor Points", value: char.totalHonorPoints.toLocaleString(), color: "text-primary" },
          { label: "Arena Points", value: char.arenaPoints.toLocaleString(), color: "text-accent" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-card p-4"
          >
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className={`text-lg font-semibold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
