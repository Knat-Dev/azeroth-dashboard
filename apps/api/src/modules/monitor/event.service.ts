import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type Database from 'better-sqlite3';
import { getDatabase, closeDatabase } from '../../config/sqlite.config.js';

export interface ServerEvent {
  id: number;
  timestamp: string;
  container: string;
  event_type: string;
  details: string | null;
  duration_ms: number | null;
  actor: string | null;
}

@Injectable()
export class EventService implements OnModuleDestroy {
  private readonly logger = new Logger(EventService.name);
  private db: Database.Database;

  constructor() {
    this.db = getDatabase();
  }

  onModuleDestroy() {
    closeDatabase();
  }

  logEvent(
    container: string,
    eventType: string,
    details?: string,
    durationMs?: number,
    actor?: string,
  ): void {
    try {
      this.db
        .prepare(
          `INSERT INTO events (container, event_type, details, duration_ms, actor) VALUES (?, ?, ?, ?, ?)`,
        )
        .run(
          container,
          eventType,
          details ?? null,
          durationMs ?? null,
          actor ?? null,
        );
    } catch (err) {
      this.logger.error(`Failed to log event: ${err}`);
    }
  }

  getEvents(limit = 50, container?: string): ServerEvent[] {
    try {
      if (container) {
        return this.db
          .prepare(
            `SELECT * FROM events WHERE container = ? ORDER BY id DESC LIMIT ?`,
          )
          .all(container, limit) as ServerEvent[];
      }
      return this.db
        .prepare(`SELECT * FROM events ORDER BY id DESC LIMIT ?`)
        .all(limit) as ServerEvent[];
    } catch (err) {
      this.logger.error(`Failed to get events: ${err}`);
      return [];
    }
  }

  getEventsPaginated(
    page = 1,
    limit = 20,
    container?: string,
  ): { data: ServerEvent[]; total: number; page: number; limit: number } {
    try {
      const offset = (page - 1) * limit;
      let total: number;
      let data: ServerEvent[];

      if (container) {
        const countRow = this.db
          .prepare(`SELECT COUNT(*) as count FROM events WHERE container = ?`)
          .get(container) as { count: number };
        total = countRow.count;
        data = this.db
          .prepare(
            `SELECT * FROM events WHERE container = ? ORDER BY id DESC LIMIT ? OFFSET ?`,
          )
          .all(container, limit, offset) as ServerEvent[];
      } else {
        const countRow = this.db
          .prepare(`SELECT COUNT(*) as count FROM events`)
          .get() as { count: number };
        total = countRow.count;
        data = this.db
          .prepare(`SELECT * FROM events ORDER BY id DESC LIMIT ? OFFSET ?`)
          .all(limit, offset) as ServerEvent[];
      }

      return { data, total, page, limit };
    } catch (err) {
      this.logger.error(`Failed to get paginated events: ${err}`);
      return { data: [], total: 0, page, limit };
    }
  }

  getEventsSince(since: string, container?: string): ServerEvent[] {
    try {
      if (container) {
        return this.db
          .prepare(
            `SELECT * FROM events WHERE timestamp >= ? AND container = ? ORDER BY id DESC`,
          )
          .all(since, container) as ServerEvent[];
      }
      return this.db
        .prepare(`SELECT * FROM events WHERE timestamp >= ? ORDER BY id DESC`)
        .all(since) as ServerEvent[];
    } catch (err) {
      this.logger.error(`Failed to get events since ${since}: ${err}`);
      return [];
    }
  }

  countEventsSince(
    since: string,
    container: string,
    eventType: string,
  ): number {
    try {
      const row = this.db
        .prepare(
          `SELECT COUNT(*) as count FROM events WHERE timestamp >= ? AND container = ? AND event_type = ?`,
        )
        .get(since, container, eventType) as { count: number } | undefined;
      return row?.count ?? 0;
    } catch {
      return 0;
    }
  }

  /** Record player count snapshot */
  recordPlayerCount(count: number): void {
    try {
      this.db
        .prepare(`INSERT INTO player_history (count) VALUES (?)`)
        .run(count);
    } catch (err) {
      this.logger.error(`Failed to record player count: ${err}`);
    }
  }

  /** Get player history for a time range */
  getPlayerHistory(
    range: '24h' | '7d' | '30d',
  ): { timestamp: string; count: number }[] {
    const hours = range === '24h' ? 24 : range === '7d' ? 168 : 720;
    try {
      return this.db
        .prepare(
          `SELECT timestamp, count FROM player_history WHERE timestamp >= datetime('now', ?) ORDER BY timestamp ASC`,
        )
        .all(`-${hours} hours`) as { timestamp: string; count: number }[];
    } catch (err) {
      this.logger.error(`Failed to get player history: ${err}`);
      return [];
    }
  }

  /** Prune old player history (older than 30 days) */
  prunePlayerHistory(): void {
    try {
      const result = this.db
        .prepare(
          `DELETE FROM player_history WHERE timestamp < datetime('now', '-30 days')`,
        )
        .run();
      if (result.changes > 0) {
        this.logger.log(`Pruned ${result.changes} old player history records`);
      }
    } catch (err) {
      this.logger.error(`Failed to prune player history: ${err}`);
    }
  }

  /** Get a setting value */
  getSetting(key: string): string | null {
    try {
      const row = this.db
        .prepare(`SELECT value FROM settings WHERE key = ?`)
        .get(key) as { value: string } | undefined;
      return row?.value ?? null;
    } catch {
      return null;
    }
  }

  /** Set a setting value */
  setSetting(key: string, value: string): void {
    try {
      this.db
        .prepare(
          `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        )
        .run(key, value);
    } catch (err) {
      this.logger.error(`Failed to set setting ${key}: ${err}`);
    }
  }

  /** Record container resource stats snapshot */
  recordContainerStats(
    container: string,
    cpuPercent: number,
    memoryUsageMB: number,
    memoryLimitMB: number,
    timestamp?: string,
  ): void {
    try {
      if (timestamp) {
        this.db
          .prepare(
            `INSERT INTO container_stats (timestamp, container, cpu_percent, memory_usage_mb, memory_limit_mb) VALUES (?, ?, ?, ?, ?)`,
          )
          .run(timestamp, container, cpuPercent, memoryUsageMB, memoryLimitMB);
      } else {
        this.db
          .prepare(
            `INSERT INTO container_stats (container, cpu_percent, memory_usage_mb, memory_limit_mb) VALUES (?, ?, ?, ?)`,
          )
          .run(container, cpuPercent, memoryUsageMB, memoryLimitMB);
      }
    } catch (err) {
      this.logger.error(`Failed to record container stats: ${err}`);
    }
  }

  /** Get container stats history for a time range */
  getContainerStatsHistory(
    range: '1m' | '5m' | '15m' | '30m' | '1h' | '6h' | '24h' | '7d',
    container?: string,
  ): { timestamp: string; container: string; cpuPercent: number; memoryUsageMB: number; memoryLimitMB: number }[] {
    // 1m queries 2 minutes to avoid cutoff with 30s collection interval
    const minuteRanges: Record<string, number> = { '1m': 2, '5m': 5, '15m': 15, '30m': 30 };
    const hourRanges: Record<string, number> = { '1h': 1, '6h': 6, '24h': 24, '7d': 168 };
    const offset = minuteRanges[range]
      ? `-${minuteRanges[range]} minutes`
      : `-${hourRanges[range] ?? 1} hours`;
    try {
      if (container) {
        return this.db
          .prepare(
            `SELECT timestamp, container, cpu_percent as cpuPercent, memory_usage_mb as memoryUsageMB, memory_limit_mb as memoryLimitMB
             FROM container_stats WHERE timestamp >= datetime('now', ?) AND container = ? ORDER BY timestamp ASC`,
          )
          .all(offset, container) as any[];
      }
      return this.db
        .prepare(
          `SELECT timestamp, container, cpu_percent as cpuPercent, memory_usage_mb as memoryUsageMB, memory_limit_mb as memoryLimitMB
           FROM container_stats WHERE timestamp >= datetime('now', ?) ORDER BY timestamp ASC`,
        )
        .all(offset) as any[];
    } catch (err) {
      this.logger.error(`Failed to get container stats history: ${err}`);
      return [];
    }
  }

  /** Prune old container stats (older than 7 days) */
  pruneContainerStats(): void {
    try {
      const result = this.db
        .prepare(
          `DELETE FROM container_stats WHERE timestamp < datetime('now', '-7 days')`,
        )
        .run();
      if (result.changes > 0) {
        this.logger.log(`Pruned ${result.changes} old container stats records`);
      }
    } catch (err) {
      this.logger.error(`Failed to prune container stats: ${err}`);
    }
  }

  /** Get all settings as a record */
  getAllSettings(): Record<string, string> {
    try {
      const rows = this.db.prepare(`SELECT key, value FROM settings`).all() as {
        key: string;
        value: string;
      }[];
      const result: Record<string, string> = {};
      for (const row of rows) {
        result[row.key] = row.value;
      }
      return result;
    } catch {
      return {};
    }
  }
}
