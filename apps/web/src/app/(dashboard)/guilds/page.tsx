"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface Guild {
  guildid: number;
  name: string;
  memberCount: number;
  createdate: number;
}

interface GuildResponse {
  data: Guild[];
  total: number;
  page: number;
  limit: number;
}

export default function GuildsPage() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<GuildResponse>(`/guilds?page=${page}&limit=20`)
      .then((res) => {
        setGuilds(res.data);
        setTotal(res.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">Guilds</h1>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : guilds.length === 0 ? (
        <p className="text-muted-foreground">No guilds found.</p>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Members</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Created</th>
                </tr>
              </thead>
              <tbody>
                {guilds.map((guild) => (
                  <tr key={guild.guildid} className="border-b border-border last:border-0 hover:bg-secondary/50">
                    <td className="px-4 py-3">
                      <Link href={`/guilds/${guild.guildid}`} className="font-medium text-primary hover:underline">
                        {guild.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-foreground">{guild.memberCount}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {guild.createdate > 0
                        ? new Date(guild.createdate * 1000).toLocaleDateString()
                        : "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {total} guilds total
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg bg-secondary px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={guilds.length < 20}
                className="rounded-lg bg-secondary px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
