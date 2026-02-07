export const WOW_CLASSES: Record<number, { name: string; color: string }> = {
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

export const WOW_RACES: Record<number, string> = {
  1: "Human",
  2: "Orc",
  3: "Dwarf",
  4: "Night Elf",
  5: "Undead",
  6: "Tauren",
  7: "Gnome",
  8: "Troll",
  10: "Blood Elf",
  11: "Draenei",
};

export const ALLIANCE_RACES = new Set([1, 3, 4, 7, 11]);
export const HORDE_RACES = new Set([2, 5, 6, 8, 10]);

export function getFaction(raceId: number): "Alliance" | "Horde" | "Unknown" {
  if (ALLIANCE_RACES.has(raceId)) return "Alliance";
  if (HORDE_RACES.has(raceId)) return "Horde";
  return "Unknown";
}
