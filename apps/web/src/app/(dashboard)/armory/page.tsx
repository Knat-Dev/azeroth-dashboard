"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { WOW_CLASSES, WOW_RACES } from "@/lib/constants";
import { Search } from "lucide-react";

interface Character {
  guid: number;
  name: string;
  race: number;
  class: number;
  level: number;
}

export default function ArmoryPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Character[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const chars = await api.get<Character[]>(
        `/characters/search?name=${encodeURIComponent(query)}`,
      );
      setResults(chars);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Armory Search</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search for characters across the server
        </p>
      </div>

      <form onSubmit={handleSearch} className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search character name..."
            className="w-full rounded-lg border border-input bg-secondary pl-10 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {searched && !loading && results.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16">
          <Search className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-muted-foreground">No characters found matching &ldquo;{query}&rdquo;.</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Level</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Race</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Class</th>
              </tr>
            </thead>
            <tbody>
              {results.map((char) => {
                const cls = WOW_CLASSES[char.class];
                return (
                  <tr
                    key={char.guid}
                    className="border-b border-border/50 last:border-0 transition-colors hover:bg-secondary/30"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/characters/${char.guid}`}
                        className="font-medium hover:underline"
                        style={{ color: cls?.color ?? "#fff" }}
                      >
                        {char.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-xs font-medium text-primary">
                        {char.level}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {WOW_RACES[char.race]}
                    </td>
                    <td className="px-4 py-3" style={{ color: cls?.color }}>
                      {cls?.name}
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
