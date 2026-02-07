"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

const WOW_CLASSES: Record<number, { name: string; color: string }> = {
  1: { name: "Warrior", color: "#C79C6E" }, 2: { name: "Paladin", color: "#F58CBA" },
  3: { name: "Hunter", color: "#ABD473" }, 4: { name: "Rogue", color: "#FFF569" },
  5: { name: "Priest", color: "#FFFFFF" }, 6: { name: "Death Knight", color: "#C41F3B" },
  7: { name: "Shaman", color: "#0070DE" }, 8: { name: "Mage", color: "#69CCF0" },
  9: { name: "Warlock", color: "#9482C9" }, 11: { name: "Druid", color: "#FF7D0A" },
};

interface GuildDetail {
  guildid: number;
  name: string;
  motd: string;
  info: string;
  members: {
    guid: number;
    rank: number;
    character: { guid: number; name: string; level: number; class: number; race: number; online: number } | null;
  }[];
}

export default function GuildDetailPage() {
  const params = useParams();
  const [guild, setGuild] = useState<GuildDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (params.id) {
      api
        .get<GuildDetail>(`/guilds/${params.id}`)
        .then(setGuild)
        .catch((e) => setError(e.message));
    }
  }, [params.id]);

  if (error) return <div className="text-destructive">{error}</div>;
  if (!guild) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold text-primary">{guild.name}</h1>
      {guild.motd && (
        <p className="mb-1 text-sm text-muted-foreground">MOTD: {guild.motd}</p>
      )}
      {guild.info && (
        <p className="mb-4 text-sm text-muted-foreground">{guild.info}</p>
      )}

      <div className="mt-6 rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Level</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Class</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Rank</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {guild.members
              .sort((a, b) => a.rank - b.rank)
              .map((member) => {
                const c = member.character;
                if (!c) return null;
                const cls = WOW_CLASSES[c.class];
                return (
                  <tr key={member.guid} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/characters/${c.guid}`}
                        className="font-medium hover:underline"
                        style={{ color: cls?.color ?? "#fff" }}
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-foreground">{c.level}</td>
                    <td className="px-4 py-3 text-muted-foreground">{cls?.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{member.rank}</td>
                    <td className="px-4 py-3">
                      {c.online ? (
                        <span className="text-green-400">Online</span>
                      ) : (
                        <span className="text-muted-foreground">Offline</span>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        {guild.members.length} members
      </p>
    </div>
  );
}
