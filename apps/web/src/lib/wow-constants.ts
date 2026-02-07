import {
  WOW_CLASSES,
  WOW_RACES,
  WOW_ZONES,
  getZoneName,
} from "@repo/shared";

// Re-export for use in components
export { WOW_CLASSES, WOW_RACES, WOW_ZONES, getZoneName };

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
