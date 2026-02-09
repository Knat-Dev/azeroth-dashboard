import Database from 'better-sqlite3';
import { Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';

const logger = new Logger('DbcSQLiteConfig');

let db: Database.Database | null = null;

export function getDbcDatabase(): Database.Database {
  if (db) return db;

  const dbDir = process.env.NODE_ENV === 'production' ? '/data' : './data';
  const dbPath = path.join(dbDir, 'dbc.db');

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  logger.log(`DBC SQLite database initialized at ${dbPath}`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS item_random_properties (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      enchantment_1 INTEGER NOT NULL DEFAULT 0,
      enchantment_2 INTEGER NOT NULL DEFAULT 0,
      enchantment_3 INTEGER NOT NULL DEFAULT 0,
      enchantment_4 INTEGER NOT NULL DEFAULT 0,
      enchantment_5 INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS item_random_suffix (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      enchantment_1 INTEGER NOT NULL DEFAULT 0,
      enchantment_2 INTEGER NOT NULL DEFAULT 0,
      enchantment_3 INTEGER NOT NULL DEFAULT 0,
      enchantment_4 INTEGER NOT NULL DEFAULT 0,
      enchantment_5 INTEGER NOT NULL DEFAULT 0,
      allocation_pct_1 INTEGER NOT NULL DEFAULT 0,
      allocation_pct_2 INTEGER NOT NULL DEFAULT 0,
      allocation_pct_3 INTEGER NOT NULL DEFAULT 0,
      allocation_pct_4 INTEGER NOT NULL DEFAULT 0,
      allocation_pct_5 INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS spell_item_enchantment (
      id INTEGER PRIMARY KEY,
      charges INTEGER NOT NULL DEFAULT 0,
      effect_1 INTEGER NOT NULL DEFAULT 0,
      effect_2 INTEGER NOT NULL DEFAULT 0,
      effect_3 INTEGER NOT NULL DEFAULT 0,
      effect_points_min_1 INTEGER NOT NULL DEFAULT 0,
      effect_points_min_2 INTEGER NOT NULL DEFAULT 0,
      effect_points_min_3 INTEGER NOT NULL DEFAULT 0,
      effect_points_max_1 INTEGER NOT NULL DEFAULT 0,
      effect_points_max_2 INTEGER NOT NULL DEFAULT 0,
      effect_points_max_3 INTEGER NOT NULL DEFAULT 0,
      effect_arg_1 INTEGER NOT NULL DEFAULT 0,
      effect_arg_2 INTEGER NOT NULL DEFAULT 0,
      effect_arg_3 INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS rand_prop_points (
      id INTEGER PRIMARY KEY,
      epic_1 INTEGER NOT NULL DEFAULT 0,
      epic_2 INTEGER NOT NULL DEFAULT 0,
      epic_3 INTEGER NOT NULL DEFAULT 0,
      epic_4 INTEGER NOT NULL DEFAULT 0,
      epic_5 INTEGER NOT NULL DEFAULT 0,
      superior_1 INTEGER NOT NULL DEFAULT 0,
      superior_2 INTEGER NOT NULL DEFAULT 0,
      superior_3 INTEGER NOT NULL DEFAULT 0,
      superior_4 INTEGER NOT NULL DEFAULT 0,
      superior_5 INTEGER NOT NULL DEFAULT 0,
      good_1 INTEGER NOT NULL DEFAULT 0,
      good_2 INTEGER NOT NULL DEFAULT 0,
      good_3 INTEGER NOT NULL DEFAULT 0,
      good_4 INTEGER NOT NULL DEFAULT 0,
      good_5 INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS scaling_stat_distribution (
      id INTEGER PRIMARY KEY,
      stat_id_1 INTEGER NOT NULL DEFAULT -1,
      stat_id_2 INTEGER NOT NULL DEFAULT -1,
      stat_id_3 INTEGER NOT NULL DEFAULT -1,
      stat_id_4 INTEGER NOT NULL DEFAULT -1,
      stat_id_5 INTEGER NOT NULL DEFAULT -1,
      stat_id_6 INTEGER NOT NULL DEFAULT -1,
      stat_id_7 INTEGER NOT NULL DEFAULT -1,
      stat_id_8 INTEGER NOT NULL DEFAULT -1,
      stat_id_9 INTEGER NOT NULL DEFAULT -1,
      stat_id_10 INTEGER NOT NULL DEFAULT -1,
      bonus_1 INTEGER NOT NULL DEFAULT 0,
      bonus_2 INTEGER NOT NULL DEFAULT 0,
      bonus_3 INTEGER NOT NULL DEFAULT 0,
      bonus_4 INTEGER NOT NULL DEFAULT 0,
      bonus_5 INTEGER NOT NULL DEFAULT 0,
      bonus_6 INTEGER NOT NULL DEFAULT 0,
      bonus_7 INTEGER NOT NULL DEFAULT 0,
      bonus_8 INTEGER NOT NULL DEFAULT 0,
      bonus_9 INTEGER NOT NULL DEFAULT 0,
      bonus_10 INTEGER NOT NULL DEFAULT 0,
      maxlevel INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS scaling_stat_values (
      id INTEGER PRIMARY KEY,
      charlevel INTEGER NOT NULL DEFAULT 0,
      shoulder_budget INTEGER NOT NULL DEFAULT 0,
      trinket_budget INTEGER NOT NULL DEFAULT 0,
      weapon_budget_1h INTEGER NOT NULL DEFAULT 0,
      ranged_budget INTEGER NOT NULL DEFAULT 0,
      primary_budget INTEGER NOT NULL DEFAULT 0,
      tertiary_budget INTEGER NOT NULL DEFAULT 0,
      cloth_shoulder_armor INTEGER NOT NULL DEFAULT 0,
      leather_shoulder_armor INTEGER NOT NULL DEFAULT 0,
      mail_shoulder_armor INTEGER NOT NULL DEFAULT 0,
      plate_shoulder_armor INTEGER NOT NULL DEFAULT 0,
      cloth_cloak_armor INTEGER NOT NULL DEFAULT 0,
      cloth_chest_armor INTEGER NOT NULL DEFAULT 0,
      leather_chest_armor INTEGER NOT NULL DEFAULT 0,
      mail_chest_armor INTEGER NOT NULL DEFAULT 0,
      plate_chest_armor INTEGER NOT NULL DEFAULT 0,
      weapon_dps_1h INTEGER NOT NULL DEFAULT 0,
      weapon_dps_2h INTEGER NOT NULL DEFAULT 0,
      spellcaster_dps_1h INTEGER NOT NULL DEFAULT 0,
      spellcaster_dps_2h INTEGER NOT NULL DEFAULT 0,
      ranged_dps INTEGER NOT NULL DEFAULT 0,
      wand_dps INTEGER NOT NULL DEFAULT 0,
      spell_power INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS item_spell_text (
      id INTEGER PRIMARY KEY,
      description TEXT
    );
  `);

  logger.log('DBC SQLite tables initialized');
  return db;
}

export function closeDbcDatabase(): void {
  if (db) {
    db.close();
    db = null;
    logger.log('DBC SQLite database closed');
  }
}
