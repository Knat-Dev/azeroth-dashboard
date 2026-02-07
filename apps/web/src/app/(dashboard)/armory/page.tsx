"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Search } from "lucide-react";

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

interface Character {
  guid: number; name: string; race: number; class: number; level: number;
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
      const chars = await api.get<Character[]>(`/characters/search?name=${encodeURIComponent(query)}`);
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
      <h1 className="mb-6 text-2xl font-bold text-foreground">Armory Search</h1>

      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search character name..."
            className="w-full rounded-lg border border-input bg-secondary pl-10 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Search
        </button>
      </form>

      {loading && <p className="text-muted-foreground">Searching...</p>}

      {searched && !loading && results.length === 0 && (
        <p className="text-muted-foreground">No characters found.</p>
      )}

      {results.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Level</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Race</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Class</th>
              </tr>
            </thead>
            <tbody>
              {results.map((char) => {
                const cls = WOW_CLASSES[char.class];
                return (
                  <tr key={char.guid} className="border-b border-border last:border-0 hover:bg-secondary/50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/characters/${char.guid}`}
                        className="font-medium hover:underline"
                        style={{ color: cls?.color ?? "#fff" }}
                      >
                        {char.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-primary font-mono">{char.level}</td>
                    <td className="px-4 py-3 text-muted-foreground">{WOW_RACES[char.race]}</td>
                    <td className="px-4 py-3" style={{ color: cls?.color }}>{cls?.name}</td>
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
