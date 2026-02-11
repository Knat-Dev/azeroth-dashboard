export interface ContinentMapConfig {
  id: number;          // MapID (0, 1, 530, 571)
  name: string;        // Display name
  key: string;         // Image filename stem
  imageWidth: number;  // 1024
  imageHeight: number; // 768
  locLeft: number;     // WorldMapArea Y-axis west boundary
  locRight: number;    // WorldMapArea Y-axis east boundary
  locTop: number;      // WorldMapArea X-axis north boundary
  locBottom: number;   // WorldMapArea X-axis south boundary
}

/**
 * Continent map configurations with coordinate bounds from WorldMapArea.dbc.
 * These bounds define how WoW's in-game coordinates (positionX, positionY)
 * map to pixel positions on the 1024x768 continent overview maps.
 */
export const CONTINENT_MAPS: ContinentMapConfig[] = [
  {
    id: 0,
    name: 'Eastern Kingdoms',
    key: 'eastern-kingdoms',
    imageWidth: 1024,
    imageHeight: 768,
    locLeft: 18171.970703125,
    locRight: -22569.2109375,
    locTop: 11176.34375,
    locBottom: -15973.34375,
  },
  {
    id: 1,
    name: 'Kalimdor',
    key: 'kalimdor',
    imageWidth: 1024,
    imageHeight: 768,
    locLeft: 17066.599609375,
    locRight: -19733.2109375,
    locTop: 12799.900390625,
    locBottom: -11733.2998046875,
  },
  {
    id: 530,
    name: 'Outland',
    key: 'outland',
    imageWidth: 1024,
    imageHeight: 768,
    locLeft: 12996.0390625,
    locRight: -4468.0390625,
    locTop: 5821.359375,
    locBottom: -5821.359375,
  },
  {
    id: 571,
    name: 'Northrend',
    key: 'northrend',
    imageWidth: 1024,
    imageHeight: 768,
    locLeft: 9217.15234375,
    locRight: -8534.24609375,
    locTop: 10593.375,
    locBottom: -1240.8900146484375,
  },
];

/**
 * WoW 3.3.5a WorldMapDetailFrame dimensions.
 * The 4x3 BLP tile grid is 1024x768, but the client's visible frame is 1002x668.
 * DBC coordinate bounds map to this visible area, not the full tile grid.
 * The frame is anchored at the top-left — extra pixels are clipped from the
 * right (22px) and bottom (100px).
 */
export const MAP_FRAME_WIDTH = 1002;
export const MAP_FRAME_HEIGHT = 668;

export type Faction = 'alliance' | 'horde' | 'neutral';

export type PoiType = 'town' | 'city';

export interface MapCity {
  name: string;
  type: PoiType;
  mapId: number;
  gameX: number; // position_x (north-south)
  gameY: number; // position_y (east-west)
}

/**
 * All town & city POIs from AreaPOI.dbc with world coordinates.
 * Icon 5 = town (yellow thatched house), Icon 6 = city (grey stone castle).
 * WoW uses the same icon for all factions — no faction coloring on the world map.
 */
export const MAP_CITIES: MapCity[] = [
  // ── Eastern Kingdoms (map 0) ── Cities
  { name: 'Stormwind City',    type: 'city', mapId: 0, gameX: -9153.77, gameY: 364.06 },
  { name: 'Ironforge',         type: 'city', mapId: 0, gameX: -5021.00, gameY: -834.06 },
  { name: 'Undercity',         type: 'city', mapId: 0, gameX: 1849.69,  gameY: 235.70 },
  // ── Eastern Kingdoms (map 0) ── Towns
  { name: 'Aerie Peak',        type: 'town', mapId: 0, gameX: 234.85,    gameY: -2127.76 },
  { name: 'Booty Bay',         type: 'town', mapId: 0, gameX: -14383.30, gameY: 487.14 },
  { name: 'Darkshire',         type: 'town', mapId: 0, gameX: -10564.70, gameY: -1170.65 },
  { name: 'Grom\'gol',         type: 'town', mapId: 0, gameX: -12378.40, gameY: 185.73 },
  { name: 'Hammerfall',        type: 'town', mapId: 0, gameX: -991.57,   gameY: -3528.34 },
  { name: 'Kargath',           type: 'town', mapId: 0, gameX: -6676.42,  gameY: -2186.68 },
  { name: 'Lakeshire',         type: 'town', mapId: 0, gameX: -9227.69,  gameY: -2201.47 },
  { name: 'Menethil Harbor',   type: 'town', mapId: 0, gameX: -3672.70,  gameY: -828.46 },
  { name: 'Revantusk Village', type: 'town', mapId: 0, gameX: -573.46,   gameY: -4590.51 },
  { name: 'Sentinel Hill',     type: 'town', mapId: 0, gameX: -10503.70, gameY: 1027.76 },
  { name: 'Southshore',        type: 'town', mapId: 0, gameX: -803.03,   gameY: -531.73 },
  { name: 'Stonard',           type: 'town', mapId: 0, gameX: -10443.70, gameY: -3277.49 },
  { name: 'Tarren Mill',       type: 'town', mapId: 0, gameX: -27.04,    gameY: -900.56 },
  { name: 'The Sepulcher',     type: 'town', mapId: 0, gameX: 508.07,    gameY: 1619.02 },
  { name: 'Thelsamar',         type: 'town', mapId: 0, gameX: -5349.27,  gameY: -2959.91 },

  // ── Kalimdor (map 1) ── Cities
  { name: 'Orgrimmar',             type: 'city', mapId: 1, gameX: 1381.77,  gameY: -4371.16 },
  { name: 'Thunder Bluff',         type: 'city', mapId: 1, gameX: -1205.41, gameY: 29.42 },
  { name: 'Darnassus',             type: 'city', mapId: 1, gameX: 9951.75,  gameY: 2254.50 },
  // ── Kalimdor (map 1) ── Towns
  { name: 'Astranaar',             type: 'town', mapId: 1, gameX: 2720.43,  gameY: -382.39 },
  { name: 'Auberdine',             type: 'town', mapId: 1, gameX: 6439.33,  gameY: 411.95 },
  { name: 'Camp Mojache',          type: 'town', mapId: 1, gameX: -4394.98, gameY: 215.61 },
  { name: 'Camp Taurajo',          type: 'town', mapId: 1, gameX: -2352.66, gameY: -1921.67 },
  { name: 'Cenarion Hold',         type: 'town', mapId: 1, gameX: -6886.15, gameY: 718.40 },
  { name: 'Crossroads',            type: 'town', mapId: 1, gameX: -455.90,  gameY: -2652.15 },
  { name: 'Everlook',              type: 'town', mapId: 1, gameX: 6723.46,  gameY: -4662.50 },
  { name: 'Feathermoon',           type: 'town', mapId: 1, gameX: -4434.99, gameY: 3276.74 },
  { name: 'Freewind Post',         type: 'town', mapId: 1, gameX: -5454.07, gameY: -2445.50 },
  { name: 'Gadgetzan',             type: 'town', mapId: 1, gameX: -7139.15, gameY: -3752.11 },
  { name: 'Mudsprocket',           type: 'town', mapId: 1, gameX: -4590.83, gameY: -3182.50 },
  { name: 'Nijel\'s Point',        type: 'town', mapId: 1, gameX: 202.52,   gameY: 1308.24 },
  { name: 'Ratchet',               type: 'town', mapId: 1, gameX: -951.36,  gameY: -3680.07 },
  { name: 'Shadowprey Village',    type: 'town', mapId: 1, gameX: -1657.85, gameY: 3097.92 },
  { name: 'Splintertree Post',     type: 'town', mapId: 1, gameX: 2286.41,  gameY: -2564.67 },
  { name: 'Stonetalon Peak',       type: 'town', mapId: 1, gameX: 2658.78,  gameY: 1449.71 },
  { name: 'Sun Rock Retreat',      type: 'town', mapId: 1, gameX: 936.31,   gameY: 910.97 },
  { name: 'Thalanaar',             type: 'town', mapId: 1, gameX: -4510.03, gameY: -779.47 },
  { name: 'Theramore',             type: 'town', mapId: 1, gameX: -3680.17, gameY: -4388.51 },

  // ── Outland (map 530) ── Cities
  { name: 'Shattrath City',        type: 'city', mapId: 530, gameX: -1863.83, gameY: 5429.83 },
  // ── Outland (map 530) ── Towns
  { name: 'Allerian Stronghold',   type: 'town', mapId: 530, gameX: -2958.41, gameY: 3971.65 },
  { name: 'Altar of Sha\'tar',     type: 'town', mapId: 530, gameX: -3042.85, gameY: 804.58 },
  { name: 'Area 52',               type: 'town', mapId: 530, gameX: 3031.08,  gameY: 3687.24 },
  { name: 'Cenarion Refuge',       type: 'town', mapId: 530, gameX: -237.10,  gameY: 5519.13 },
  { name: 'Cosmowrench',           type: 'town', mapId: 530, gameX: 2964.62,  gameY: 1789.14 },
  { name: 'Evergrove',             type: 'town', mapId: 530, gameX: 2990.17,  gameY: 5470.22 },
  { name: 'Falcon Watch',          type: 'town', mapId: 530, gameX: -699.53,  gameY: 4260.89 },
  { name: 'Garadar',               type: 'town', mapId: 530, gameX: -1322.49, gameY: 7214.32 },
  { name: 'Honor Hold',            type: 'town', mapId: 530, gameX: -715.97,  gameY: 2670.63 },
  { name: 'Ogri\'la',              type: 'town', mapId: 530, gameX: 2329.84,  gameY: 7297.04 },
  { name: 'Orebor Harborage',      type: 'town', mapId: 530, gameX: 999.59,   gameY: 7369.97 },
  { name: 'Sanctum of the Stars',  type: 'town', mapId: 530, gameX: -4099.49, gameY: 1117.34 },
  { name: 'Shadowmoon Village',    type: 'town', mapId: 530, gameX: -3022.78, gameY: 2582.05 },
  { name: 'Sporeggar',             type: 'town', mapId: 530, gameX: 233.30,   gameY: 8498.02 },
  { name: 'Stonebreaker Hold',     type: 'town', mapId: 530, gameX: -2643.03, gameY: 4416.87 },
  { name: 'Swamprat Post',         type: 'town', mapId: 530, gameX: 103.67,   gameY: 5204.96 },
  { name: 'Sylvanaar',             type: 'town', mapId: 530, gameX: 2057.07,  gameY: 6845.29 },
  { name: 'Telaar',                type: 'town', mapId: 530, gameX: -2657.54, gameY: 7282.29 },
  { name: 'Telredor',              type: 'town', mapId: 530, gameX: 281.78,   gameY: 6042.78 },
  { name: 'Temple of Telhamat',    type: 'town', mapId: 530, gameX: 143.14,   gameY: 4333.41 },
  { name: 'The Stormspire',        type: 'town', mapId: 530, gameX: 4119.72,  gameY: 2995.70 },
  { name: 'Thrallmar',             type: 'town', mapId: 530, gameX: 138.91,   gameY: 2703.56 },
  { name: 'Thunderlord Stronghold', type: 'town', mapId: 530, gameX: 2395.66, gameY: 6000.24 },
  { name: 'Toshley\'s Station',    type: 'town', mapId: 530, gameX: 1917.50,  gameY: 5566.59 },
  { name: 'Wildhammer Stronghold', type: 'town', mapId: 530, gameX: -3995.69, gameY: 2186.96 },
  { name: 'Zabra\'jin',            type: 'town', mapId: 530, gameX: 256.99,   gameY: 7853.89 },

  // ── Northrend (map 571) ── Cities
  { name: 'Dalaran',                   type: 'city', mapId: 571, gameX: 5805.22,  gameY: 639.99 },
  // ── Northrend (map 571) ── Towns
  { name: 'Agmar\'s Hammer',           type: 'town', mapId: 571, gameX: 3830.90,  gameY: 1580.96 },
  { name: 'Amberpine Lodge',           type: 'town', mapId: 571, gameX: 3415.69,  gameY: -2788.00 },
  { name: 'Bor\'gorok Outpost',        type: 'town', mapId: 571, gameX: 4497.92,  gameY: 5727.56 },
  { name: 'Brunnhildar Village',       type: 'town', mapId: 571, gameX: 6953.43,  gameY: -1653.60 },
  { name: 'Camp Oneqwah',              type: 'town', mapId: 571, gameX: 3855.81,  gameY: -4524.73 },
  { name: 'Camp Tunka\'lo',            type: 'town', mapId: 571, gameX: 7795.98,  gameY: -2885.31 },
  { name: 'Camp Winterhoof',           type: 'town', mapId: 571, gameX: 2666.23,  gameY: -4362.25 },
  { name: 'Conquest Hold',             type: 'town', mapId: 571, gameX: 3250.52,  gameY: -2252.59 },
  { name: 'Crusaders\' Pinnacle',      type: 'town', mapId: 571, gameX: 6410.24,  gameY: 441.83 },
  { name: 'Death\'s Rise',             type: 'town', mapId: 571, gameX: 7424.22,  gameY: 4187.86 },
  { name: 'Fizzcrank Airstrip',        type: 'town', mapId: 571, gameX: 4158.73,  gameY: 5281.77 },
  { name: 'Fort Wildervar',            type: 'town', mapId: 571, gameX: 2448.53,  gameY: -5114.01 },
  { name: 'Frosthold',                 type: 'town', mapId: 571, gameX: 6680.32,  gameY: -231.68 },
  { name: 'Grom\'arsh Crash-Site',     type: 'town', mapId: 571, gameX: 7857.19,  gameY: -749.90 },
  { name: 'K3',                        type: 'town', mapId: 571, gameX: 6124.23,  gameY: -1061.87 },
  { name: 'Kamagua',                   type: 'town', mapId: 571, gameX: 767.47,   gameY: -2904.19 },
  { name: 'Moa\'ki Harbor',            type: 'town', mapId: 571, gameX: 2780.97,  gameY: 878.93 },
  { name: 'Nesingwary Base Camp',      type: 'town', mapId: 571, gameX: 5565.21,  gameY: 5757.52 },
  { name: 'New Agamand',               type: 'town', mapId: 571, gameX: 407.82,   gameY: -4599.75 },
  { name: 'Stars\' Rest',              type: 'town', mapId: 571, gameX: 3495.58,  gameY: 1993.21 },
  { name: 'Taunka\'le Village',        type: 'town', mapId: 571, gameX: 3445.23,  gameY: 4111.00 },
  { name: 'The Argent Stand',          type: 'town', mapId: 571, gameX: 5450.08,  gameY: -2575.08 },
  { name: 'The Shadow Vault',          type: 'town', mapId: 571, gameX: 8428.89,  gameY: 2707.51 },
  { name: 'Unu\'pe',                   type: 'town', mapId: 571, gameX: 3013.88,  gameY: 4103.26 },
  { name: 'Valgarde',                  type: 'town', mapId: 571, gameX: 616.89,   gameY: -5007.05 },
  { name: 'Valiance Keep',             type: 'town', mapId: 571, gameX: 2279.52,  gameY: 5248.36 },
  { name: 'Vengeance Landing',         type: 'town', mapId: 571, gameX: 1923.22,  gameY: -6160.07 },
  { name: 'Venomspite',                type: 'town', mapId: 571, gameX: 3240.58,  gameY: -692.57 },
  { name: 'Warsong Hold',              type: 'town', mapId: 571, gameX: 2837.43,  gameY: 6186.49 },
  { name: 'Westfall Brigade',          type: 'town', mapId: 571, gameX: 4554.15,  gameY: -4213.86 },
  { name: 'Westguard Keep',            type: 'town', mapId: 571, gameX: 1386.61,  gameY: -3247.23 },
  { name: 'Wintergarde Keep',          type: 'town', mapId: 571, gameX: 3780.27,  gameY: -734.76 },
  { name: 'Wyrmrest Temple',           type: 'town', mapId: 571, gameX: 3546.80,  gameY: 273.26 },
  { name: 'Zim\'Torga',               type: 'town', mapId: 571, gameX: 5764.67,  gameY: -3563.47 },
];

/**
 * Convert WoW in-game coordinates to map image pixel coordinates.
 *
 * WoW's coordinate system: X = North-South, Y = East-West (swapped from map convention).
 * - locLeft/locRight are Y-axis (east-west) boundaries
 * - locTop/locBottom are X-axis (north-south) boundaries
 *
 * DBC bounds map to the 1002x668 WorldMapDetailFrame, anchored at image top-left.
 */
export function gameToMapPixel(
  config: ContinentMapConfig,
  gameX: number,
  gameY: number,
): { x: number; y: number } {
  return {
    x: ((config.locLeft - gameY) / (config.locLeft - config.locRight)) * MAP_FRAME_WIDTH,
    y: ((config.locTop - gameX) / (config.locTop - config.locBottom)) * MAP_FRAME_HEIGHT,
  };
}

/**
 * Convert image pixel coordinates to WoW-style normalized map position (0–100).
 * This is the inverse of gameToMapPixel, returning the percentage coordinates
 * that WoW addons like TomTom display.
 */
export function pixelToMapPercent(
  pixelX: number,
  pixelY: number,
): { x: number; y: number } {
  return {
    x: (pixelX / MAP_FRAME_WIDTH) * 100,
    y: (pixelY / MAP_FRAME_HEIGHT) * 100,
  };
}
