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

export const WOW_ZONES: Record<number, string> = {
  // Eastern Kingdoms
  1: "Dun Morogh",
  12: "Elwynn Forest",
  14: "Durotar",
  15: "Dustwallow Marsh",
  17: "The Barrens",
  33: "Stranglethorn Vale",
  38: "Loch Modan",
  40: "Westfall",
  44: "Redridge Mountains",
  45: "Arathi Highlands",
  46: "Burning Steppes",
  47: "The Hinterlands",
  51: "Searing Gorge",
  85: "Tirisfal Glades",
  130: "Silverpine Forest",
  139: "Eastern Plaguelands",
  141: "Teldrassil",
  148: "Darkshore",
  209: "Shadowfang Keep",
  215: "Mulgore",
  267: "Hillsbrad Foothills",
  331: "Ashenvale",
  357: "Feralas",
  361: "Felwood",
  394: "Grizzly Hills",
  400: "Thousand Needles",
  405: "Desolace",
  406: "Stonetalon Mountains",
  440: "Tanaris",
  490: "Un'Goro Crater",
  493: "Moonglade",
  618: "Winterspring",
  1377: "Silithus",
  1497: "Undercity",
  1519: "Stormwind City",
  1537: "Ironforge",
  1637: "Orgrimmar",
  1638: "Thunder Bluff",
  1657: "Darnassus",
  2817: "Crystalsong Forest",
  3430: "Eversong Woods",
  3433: "Ghostlands",
  3483: "Hellfire Peninsula",
  3487: "Silvermoon City",
  3518: "Nagrand",
  3519: "Terokkar Forest",
  3520: "Shadowmoon Valley",
  3521: "Zangarmarsh",
  3522: "Blade's Edge Mountains",
  3523: "Netherstorm",
  3524: "Azuremyst Isle",
  3525: "Bloodmyst Isle",
  3537: "Borean Tundra",
  3557: "The Exodar",
  3703: "Shattrath City",
  3711: "Sholazar Basin",
  4080: "Isle of Quel'Danas",
  4197: "Wintergrasp",
  4395: "Dalaran",
  4742: "Hrothgar's Landing",
  65: "Dragonblight",
  66: "Zul'Drak",
  67: "The Storm Peaks",
  210: "Icecrown",
  495: "Howling Fjord",
};

export function getClassName(classId: number): string {
  return WOW_CLASSES[classId]?.name ?? "Unknown";
}

export function getClassColor(classId: number): string {
  return WOW_CLASSES[classId]?.color ?? "#808080";
}

export function getRaceName(raceId: number): string {
  return WOW_RACES[raceId] ?? "Unknown";
}

export function getZoneName(zoneId: number): string {
  return WOW_ZONES[zoneId] ?? `Zone ${zoneId}`;
}

export function getFaction(raceId: number): "Alliance" | "Horde" | "Unknown" {
  if ([1, 3, 4, 7, 11].includes(raceId)) return "Alliance";
  if ([2, 5, 6, 8, 10].includes(raceId)) return "Horde";
  return "Unknown";
}
