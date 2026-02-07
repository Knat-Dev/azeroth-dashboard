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
