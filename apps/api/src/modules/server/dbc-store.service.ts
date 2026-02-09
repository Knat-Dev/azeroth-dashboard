import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import type Database from 'better-sqlite3';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getDbcDatabase, closeDbcDatabase } from '../../config/dbc-sqlite.config.js';

// --- Interfaces ---

export interface RandomPropertiesRow {
  id: number;
  name: string;
}

export interface RandomSuffixRow {
  id: number;
  name: string;
  enchantment1: number;
  enchantment2: number;
  enchantment3: number;
  enchantment4: number;
  enchantment5: number;
  allocationPct1: number;
  allocationPct2: number;
  allocationPct3: number;
  allocationPct4: number;
  allocationPct5: number;
}

export interface EnchantmentRow {
  id: number;
  effect1: number;
  effect2: number;
  effect3: number;
  effectPointsMin1: number;
  effectPointsMin2: number;
  effectPointsMin3: number;
  effectArg1: number;
  effectArg2: number;
  effectArg3: number;
}

export interface RandPropPointsRow {
  id: number;
  epic1: number;
  epic2: number;
  epic3: number;
  epic4: number;
  epic5: number;
  superior1: number;
  superior2: number;
  superior3: number;
  superior4: number;
  superior5: number;
  good1: number;
  good2: number;
  good3: number;
  good4: number;
  good5: number;
}

export interface ScalingStatDistributionRow {
  id: number;
  statId1: number;
  statId2: number;
  statId3: number;
  statId4: number;
  statId5: number;
  statId6: number;
  statId7: number;
  statId8: number;
  statId9: number;
  statId10: number;
  bonus1: number;
  bonus2: number;
  bonus3: number;
  bonus4: number;
  bonus5: number;
  bonus6: number;
  bonus7: number;
  bonus8: number;
  bonus9: number;
  bonus10: number;
  maxlevel: number;
}

export interface ScalingStatValuesRow {
  id: number;
  charlevel: number;
  shoulderBudget: number;
  trinketBudget: number;
  weaponBudget1H: number;
  rangedBudget: number;
  primaryBudget: number;
  tertiaryBudget: number;
  clothShoulderArmor: number;
  leatherShoulderArmor: number;
  mailShoulderArmor: number;
  plateShoulderArmor: number;
  clothCloakArmor: number;
  clothChestArmor: number;
  leatherChestArmor: number;
  mailChestArmor: number;
  plateChestArmor: number;
  weaponDPS1H: number;
  weaponDPS2H: number;
  spellcasterDPS1H: number;
  spellcasterDPS2H: number;
  rangedDPS: number;
  wandDPS: number;
  spellPower: number;
}

// --- Seed file mapping ---

const SEED_FILES = [
  { table: 'item_random_properties', file: 'itemrandomproperties.sql' },
  { table: 'item_random_suffix', file: 'itemrandomsuffix.sql' },
  { table: 'scaling_stat_distribution', file: 'scalingstatdistribution.sql' },
  { table: 'scaling_stat_values', file: 'scalingstatvalues.sql' },
  { table: 'spell_item_enchantment', file: 'spellitemenchantment.sql' },
  { table: 'rand_prop_points', file: 'randproppoints.sql' },
  { table: 'item_spell_text', file: 'item_spell_text.sql' },
];

@Injectable()
export class DbcStore implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DbcStore.name);
  private db!: Database.Database;

  onModuleInit() {
    this.db = getDbcDatabase();
    this.seedIfEmpty();
    this.logger.log('DBC store initialized');
  }

  onModuleDestroy() {
    closeDbcDatabase();
  }

  // --- Public lookup methods ---

  getRandomProperties(ids: number[]): Map<number, RandomPropertiesRow> {
    if (ids.length === 0) return new Map();
    const unique = [...new Set(ids)];
    const placeholders = unique.map(() => '?').join(',');
    const rows = this.db
      .prepare(`SELECT id, name FROM item_random_properties WHERE id IN (${placeholders})`)
      .all(...unique) as { id: number; name: string }[];
    return new Map(rows.map((r) => [r.id, r]));
  }

  getRandomSuffixes(ids: number[]): Map<number, RandomSuffixRow> {
    if (ids.length === 0) return new Map();
    const unique = [...new Set(ids)];
    const placeholders = unique.map(() => '?').join(',');
    const rows = this.db
      .prepare(
        `SELECT id, name,
                enchantment_1, enchantment_2, enchantment_3, enchantment_4, enchantment_5,
                allocation_pct_1, allocation_pct_2, allocation_pct_3, allocation_pct_4, allocation_pct_5
         FROM item_random_suffix WHERE id IN (${placeholders})`,
      )
      .all(...unique) as Record<string, number | string>[];
    return new Map(
      rows.map((r) => [
        r.id as number,
        {
          id: r.id as number,
          name: r.name as string,
          enchantment1: r.enchantment_1 as number,
          enchantment2: r.enchantment_2 as number,
          enchantment3: r.enchantment_3 as number,
          enchantment4: r.enchantment_4 as number,
          enchantment5: r.enchantment_5 as number,
          allocationPct1: r.allocation_pct_1 as number,
          allocationPct2: r.allocation_pct_2 as number,
          allocationPct3: r.allocation_pct_3 as number,
          allocationPct4: r.allocation_pct_4 as number,
          allocationPct5: r.allocation_pct_5 as number,
        },
      ]),
    );
  }

  getEnchantments(ids: number[]): Map<number, EnchantmentRow> {
    if (ids.length === 0) return new Map();
    const unique = [...new Set(ids)];
    const placeholders = unique.map(() => '?').join(',');
    const rows = this.db
      .prepare(
        `SELECT id,
                effect_1, effect_2, effect_3,
                effect_points_min_1, effect_points_min_2, effect_points_min_3,
                effect_arg_1, effect_arg_2, effect_arg_3
         FROM spell_item_enchantment WHERE id IN (${placeholders})`,
      )
      .all(...unique) as Record<string, number>[];
    return new Map(
      rows.map((r) => [
        r.id,
        {
          id: r.id,
          effect1: r.effect_1,
          effect2: r.effect_2,
          effect3: r.effect_3,
          effectPointsMin1: r.effect_points_min_1,
          effectPointsMin2: r.effect_points_min_2,
          effectPointsMin3: r.effect_points_min_3,
          effectArg1: r.effect_arg_1,
          effectArg2: r.effect_arg_2,
          effectArg3: r.effect_arg_3,
        },
      ]),
    );
  }

  getRandPropPoints(itemLevels: number[]): Map<number, RandPropPointsRow> {
    if (itemLevels.length === 0) return new Map();
    const unique = [...new Set(itemLevels)];
    const placeholders = unique.map(() => '?').join(',');
    const rows = this.db
      .prepare(
        `SELECT id,
                epic_1, epic_2, epic_3, epic_4, epic_5,
                superior_1, superior_2, superior_3, superior_4, superior_5,
                good_1, good_2, good_3, good_4, good_5
         FROM rand_prop_points WHERE id IN (${placeholders})`,
      )
      .all(...unique) as Record<string, number>[];
    return new Map(
      rows.map((r) => [
        r.id,
        {
          id: r.id,
          epic1: r.epic_1,
          epic2: r.epic_2,
          epic3: r.epic_3,
          epic4: r.epic_4,
          epic5: r.epic_5,
          superior1: r.superior_1,
          superior2: r.superior_2,
          superior3: r.superior_3,
          superior4: r.superior_4,
          superior5: r.superior_5,
          good1: r.good_1,
          good2: r.good_2,
          good3: r.good_3,
          good4: r.good_4,
          good5: r.good_5,
        },
      ]),
    );
  }

  getScalingStatDistributions(
    ids: number[],
  ): Map<number, ScalingStatDistributionRow> {
    if (ids.length === 0) return new Map();
    const unique = [...new Set(ids)];
    const placeholders = unique.map(() => '?').join(',');
    const rows = this.db
      .prepare(
        `SELECT id,
                stat_id_1, stat_id_2, stat_id_3, stat_id_4, stat_id_5,
                stat_id_6, stat_id_7, stat_id_8, stat_id_9, stat_id_10,
                bonus_1, bonus_2, bonus_3, bonus_4, bonus_5,
                bonus_6, bonus_7, bonus_8, bonus_9, bonus_10,
                maxlevel
         FROM scaling_stat_distribution WHERE id IN (${placeholders})`,
      )
      .all(...unique) as Record<string, number>[];
    return new Map(
      rows.map((r) => [
        r.id,
        {
          id: r.id,
          statId1: r.stat_id_1,
          statId2: r.stat_id_2,
          statId3: r.stat_id_3,
          statId4: r.stat_id_4,
          statId5: r.stat_id_5,
          statId6: r.stat_id_6,
          statId7: r.stat_id_7,
          statId8: r.stat_id_8,
          statId9: r.stat_id_9,
          statId10: r.stat_id_10,
          bonus1: r.bonus_1,
          bonus2: r.bonus_2,
          bonus3: r.bonus_3,
          bonus4: r.bonus_4,
          bonus5: r.bonus_5,
          bonus6: r.bonus_6,
          bonus7: r.bonus_7,
          bonus8: r.bonus_8,
          bonus9: r.bonus_9,
          bonus10: r.bonus_10,
          maxlevel: r.maxlevel,
        },
      ]),
    );
  }

  getScalingStatValues(charlevel: number): ScalingStatValuesRow | undefined {
    const row = this.db
      .prepare(
        `SELECT id, charlevel,
                shoulder_budget, trinket_budget, weapon_budget_1h, ranged_budget,
                primary_budget, tertiary_budget,
                cloth_shoulder_armor, leather_shoulder_armor, mail_shoulder_armor, plate_shoulder_armor,
                cloth_cloak_armor,
                cloth_chest_armor, leather_chest_armor, mail_chest_armor, plate_chest_armor,
                weapon_dps_1h, weapon_dps_2h, spellcaster_dps_1h, spellcaster_dps_2h,
                ranged_dps, wand_dps, spell_power
         FROM scaling_stat_values WHERE charlevel = ?`,
      )
      .get(charlevel) as Record<string, number> | undefined;
    if (!row) return undefined;
    return {
      id: row.id,
      charlevel: row.charlevel,
      shoulderBudget: row.shoulder_budget,
      trinketBudget: row.trinket_budget,
      weaponBudget1H: row.weapon_budget_1h,
      rangedBudget: row.ranged_budget,
      primaryBudget: row.primary_budget,
      tertiaryBudget: row.tertiary_budget,
      clothShoulderArmor: row.cloth_shoulder_armor,
      leatherShoulderArmor: row.leather_shoulder_armor,
      mailShoulderArmor: row.mail_shoulder_armor,
      plateShoulderArmor: row.plate_shoulder_armor,
      clothCloakArmor: row.cloth_cloak_armor,
      clothChestArmor: row.cloth_chest_armor,
      leatherChestArmor: row.leather_chest_armor,
      mailChestArmor: row.mail_chest_armor,
      plateChestArmor: row.plate_chest_armor,
      weaponDPS1H: row.weapon_dps_1h,
      weaponDPS2H: row.weapon_dps_2h,
      spellcasterDPS1H: row.spellcaster_dps_1h,
      spellcasterDPS2H: row.spellcaster_dps_2h,
      rangedDPS: row.ranged_dps,
      wandDPS: row.wand_dps,
      spellPower: row.spell_power,
    };
  }

  getSpellTexts(spellIds: number[]): Map<number, string> {
    if (spellIds.length === 0) return new Map();
    const unique = [...new Set(spellIds)];
    const placeholders = unique.map(() => '?').join(',');
    const rows = this.db
      .prepare(
        `SELECT id, description FROM item_spell_text WHERE id IN (${placeholders})`,
      )
      .all(...unique) as { id: number; description: string }[];
    return new Map(rows.map((r) => [r.id, r.description]));
  }

  // --- Seeding ---

  private seedIfEmpty() {
    for (const { table, file } of SEED_FILES) {
      try {
        const row = this.db
          .prepare(`SELECT COUNT(*) as cnt FROM ${table}`)
          .get() as { cnt: number };
        if (row.cnt > 0) {
          this.logger.log(`${table}: ${row.cnt} rows (already seeded)`);
          continue;
        }

        const seedPath = this.resolveSeedPath(file);
        if (!seedPath) {
          this.logger.warn(
            `Seed file not found for ${table} (cwd: ${process.cwd()}), skipping`,
          );
          continue;
        }

        const sql = readFileSync(seedPath, 'utf8');
        const statements = sql
          .split(/;\s*\n/)
          .map((s) => s.trim())
          .filter(Boolean);
        for (const stmt of statements) {
          this.db.exec(stmt);
        }
        this.logger.log(`Seeded ${table} from ${seedPath}`);
      } catch (err) {
        this.logger.error(
          `Failed to seed ${table}: ${(err as Error).message}`,
        );
      }
    }
  }

  private resolveSeedPath(file: string): string | null {
    const candidates = [
      join(process.cwd(), 'seeds', file),
      join(process.cwd(), 'dist', 'seeds', file),
    ];
    for (const p of candidates) {
      if (existsSync(p)) return p;
    }
    return null;
  }
}
