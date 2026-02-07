export const WOW_CLASSES: Record<number, { name: string; color: string }> = {
  1: { name: 'Warrior', color: '#C79C6E' },
  2: { name: 'Paladin', color: '#F58CBA' },
  3: { name: 'Hunter', color: '#ABD473' },
  4: { name: 'Rogue', color: '#FFF569' },
  5: { name: 'Priest', color: '#FFFFFF' },
  6: { name: 'Death Knight', color: '#C41F3B' },
  7: { name: 'Shaman', color: '#0070DE' },
  8: { name: 'Mage', color: '#69CCF0' },
  9: { name: 'Warlock', color: '#9482C9' },
  11: { name: 'Druid', color: '#FF7D0A' },
};

export const WOW_RACES: Record<number, { name: string; faction: 'Alliance' | 'Horde' }> = {
  1: { name: 'Human', faction: 'Alliance' },
  2: { name: 'Orc', faction: 'Horde' },
  3: { name: 'Dwarf', faction: 'Alliance' },
  4: { name: 'Night Elf', faction: 'Alliance' },
  5: { name: 'Undead', faction: 'Horde' },
  6: { name: 'Tauren', faction: 'Horde' },
  7: { name: 'Gnome', faction: 'Alliance' },
  8: { name: 'Troll', faction: 'Horde' },
  10: { name: 'Blood Elf', faction: 'Horde' },
  11: { name: 'Draenei', faction: 'Alliance' },
};

export enum GmLevel {
  PLAYER = 0,
  MODERATOR = 1,
  GAMEMASTER = 2,
  ADMINISTRATOR = 3,
  CONSOLE = 4,
}

export const GM_LEVEL_NAMES: Record<number, string> = {
  [GmLevel.PLAYER]: 'Player',
  [GmLevel.MODERATOR]: 'Moderator',
  [GmLevel.GAMEMASTER]: 'Game Master',
  [GmLevel.ADMINISTRATOR]: 'Administrator',
  [GmLevel.CONSOLE]: 'Console',
};

export const FACTION_COLORS = {
  Alliance: '#0078FF',
  Horde: '#B30000',
} as const;

export const MAX_ACCOUNT_STR = 17;
export const MAX_PASS_STR = 16;
export const MAX_EMAIL_STR = 255;

export const WOW_ZONES: Record<number, string> = {
  // Eastern Kingdoms
  1: 'Dun Morogh',
  12: 'Elwynn Forest',
  14: 'Durotar',
  15: 'Dustwallow Marsh',
  17: 'The Barrens',
  33: 'Stranglethorn Vale',
  38: 'Loch Modan',
  40: 'Westfall',
  44: 'Redridge Mountains',
  45: 'Arathi Highlands',
  46: 'Burning Steppes',
  47: 'The Hinterlands',
  51: 'Searing Gorge',
  65: 'Dragonblight',
  66: "Zul'Drak",
  67: 'The Storm Peaks',
  85: 'Tirisfal Glades',
  130: 'Silverpine Forest',
  139: 'Eastern Plaguelands',
  141: 'Teldrassil',
  148: 'Darkshore',
  209: 'Shadowfang Keep',
  210: 'Icecrown',
  215: 'Mulgore',
  267: 'Hillsbrad Foothills',
  331: 'Ashenvale',
  357: 'Feralas',
  361: 'Felwood',
  394: 'Grizzly Hills',
  400: 'Thousand Needles',
  405: 'Desolace',
  406: 'Stonetalon Mountains',
  440: 'Tanaris',
  490: "Un'Goro Crater",
  493: 'Moonglade',
  495: 'Howling Fjord',
  618: 'Winterspring',
  1377: 'Silithus',
  1497: 'Undercity',
  1519: 'Stormwind City',
  1537: 'Ironforge',
  1637: 'Orgrimmar',
  1638: 'Thunder Bluff',
  1657: 'Darnassus',
  2817: 'Crystalsong Forest',
  3430: 'Eversong Woods',
  3433: 'Ghostlands',
  3483: 'Hellfire Peninsula',
  3487: 'Silvermoon City',
  3518: 'Nagrand',
  3519: 'Terokkar Forest',
  3520: 'Shadowmoon Valley',
  3521: 'Zangarmarsh',
  3522: "Blade's Edge Mountains",
  3523: 'Netherstorm',
  3524: 'Azuremyst Isle',
  3525: 'Bloodmyst Isle',
  3537: 'Borean Tundra',
  3557: 'The Exodar',
  3703: 'Shattrath City',
  3711: 'Sholazar Basin',
  4080: "Isle of Quel'Danas",
  4197: 'Wintergrasp',
  4395: 'Dalaran',
  4742: "Hrothgar's Landing",
};

export function getZoneName(zoneId: number): string {
  return WOW_ZONES[zoneId] ?? `Zone ${zoneId}`;
}
