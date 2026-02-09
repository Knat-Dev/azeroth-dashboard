import Database from 'better-sqlite3';
import { Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';

const logger = new Logger('SQLiteConfig');

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (db) return db;

  const dbDir = process.env.NODE_ENV === 'production' ? '/data' : './data';
  const dbPath = path.join(dbDir, 'dashboard.db');

  // Ensure directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  logger.log(`SQLite database initialized at ${dbPath}`);

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      container TEXT NOT NULL,
      event_type TEXT NOT NULL,
      details TEXT,
      duration_ms INTEGER,
      actor TEXT
    );

    CREATE TABLE IF NOT EXISTS player_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      count INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
    CREATE INDEX IF NOT EXISTS idx_events_container ON events(container);
    CREATE INDEX IF NOT EXISTS idx_player_history_timestamp ON player_history(timestamp);

    CREATE TABLE IF NOT EXISTS container_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      container TEXT NOT NULL,
      cpu_percent REAL NOT NULL,
      memory_usage_mb REAL NOT NULL,
      memory_limit_mb REAL NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_container_stats_timestamp ON container_stats(timestamp);
    CREATE INDEX IF NOT EXISTS idx_container_stats_container ON container_stats(container);
  `);

  // Migration: add actor column if missing (safe for existing DBs)
  const columns = db.prepare(`PRAGMA table_info(events)`).all() as {
    name: string;
  }[];
  if (!columns.some((c) => c.name === 'actor')) {
    db.exec(`ALTER TABLE events ADD COLUMN actor TEXT`);
    logger.log('Migrated events table: added actor column');
  }

  logger.log('SQLite tables initialized');
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    logger.log('SQLite database closed');
  }
}
