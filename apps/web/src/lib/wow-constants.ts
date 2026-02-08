import {
  WOW_CLASSES,
  WOW_RACES,
  WOW_ZONES,
  getZoneName,
  ITEM_QUALITY_COLORS,
  getItemQualityColor,
  ITEM_BONDING,
  ITEM_INVENTORY_TYPE,
  ITEM_STAT_NAMES,
  PRIMARY_STAT_TYPES,
  EQUIP_STAT_TEXT,
  ITEM_CLASS_NAMES,
  ARMOR_SUBCLASS_NAMES,
  WEAPON_SUBCLASS_NAMES,
  DAMAGE_TYPE_NAMES,
} from "@repo/shared";

// Re-export for use in components
export {
  WOW_CLASSES,
  WOW_RACES,
  WOW_ZONES,
  getZoneName,
  ITEM_QUALITY_COLORS,
  getItemQualityColor,
  ITEM_BONDING,
  ITEM_INVENTORY_TYPE,
  ITEM_STAT_NAMES,
  PRIMARY_STAT_TYPES,
  EQUIP_STAT_TEXT,
  ITEM_CLASS_NAMES,
  ARMOR_SUBCLASS_NAMES,
  WEAPON_SUBCLASS_NAMES,
  DAMAGE_TYPE_NAMES,
};

export function getClassName(classId: number): string {
  return WOW_CLASSES[classId]?.name ?? "Unknown";
}

export function getClassColor(classId: number): string {
  return WOW_CLASSES[classId]?.color ?? "#808080";
}

export function getRaceName(raceId: number): string {
  const race = WOW_RACES[raceId];
  return race?.name ?? "Unknown";
}

export function getFaction(raceId: number): "Alliance" | "Horde" | "Unknown" {
  const race = WOW_RACES[raceId];
  if (!race) return "Unknown";
  return race.faction;
}
