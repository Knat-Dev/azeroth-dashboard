"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { WOW_CLASSES } from "@/lib/constants";
import { ArrowLeft, Shield } from "lucide-react";

interface GuildDetail {
  guildid: number;
  name: string;
  motd: string;
  info: string;
  members: {
    guid: number;
    rank: number;
    character: {
      guid: number;
      name: string;
      level: number;
      class: number;
      race: number;
      online: number;
    } | null;
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

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-6 py-4 text-sm text-destructive">
          {error}
        </div>
      </div>
    );
  }

  if (!guild) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const onlineCount = guild.members.filter(
    (m) => m.character?.online,
  ).length;

  return (
    <div>
      <Link
        href="/guilds"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to guilds
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-primary">{guild.name}</h1>
          <p className="text-sm text-muted-foreground">
            {guild.members.length} members
            {onlineCount > 0 && (
              <span className="ml-2 text-green-400">{onlineCount} online</span>
            )}
          </p>
        </div>
      </div>

      {guild.motd && (
        <div className="mb-4 rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Message of the Day
          </p>
          <p className="mt-1 text-sm text-foreground">{guild.motd}</p>
        </div>
      )}

      {guild.info && (
        <div className="mb-6 rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Guild Info
          </p>
          <p className="mt-1 text-sm text-foreground">{guild.info}</p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Level</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Class</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Rank</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
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
                  <tr
                    key={member.guid}
                    className="border-b border-border/50 last:border-0 transition-colors hover:bg-secondary/30"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/characters/${c.guid}`}
                        className="font-medium hover:underline"
                        style={{ color: cls?.color ?? "#fff" }}
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-xs font-medium text-primary">
                        {c.level}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: cls?.color }}>
                      {cls?.name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {member.rank}
                    </td>
                    <td className="px-4 py-3">
                      {c.online ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                          Online
                        </span>
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
    </div>
  );
}
