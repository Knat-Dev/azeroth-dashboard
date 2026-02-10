import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
  forwardRef,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs, createWriteStream } from 'fs';
import { join } from 'path';
import { createGzip } from 'zlib';
import mysql from 'mysql2';
import { WebhookService } from '../webhook/webhook.service.js';

const ALLOWED_DATABASES = [
  'acore_auth',
  'acore_characters',
  'acore_playerbots',
  'acore_world',
];
const DUMP_TIMEOUT_MS = 300_000; // 5 minutes
const SCHEDULE_CHECK_INTERVAL_MS = 60_000; // 1 minute
const MIN_VALID_BACKUP_SIZE = 100; // bytes
const INSERT_BATCH_SIZE = 500;

function assertSafeFilename(filename: string): void {
  if (
    !filename ||
    /[\/\\]/.test(filename) ||
    filename.includes('..') ||
    !filename.endsWith('.sql.gz')
  ) {
    throw new BadRequestException('Invalid backup filename');
  }
}

export interface BackupScheduleConfig {
  enabled: boolean;
  cron: string;
  databases: string[];
  retentionDays: number;
}

@Injectable()
export class BackupService implements OnModuleInit {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir: string;
  private readonly dbHost: string;
  private readonly dbPort: string;
  private readonly dbUser: string;
  private readonly dbPassword: string;
  private readonly retentionDays: number;
  private scheduleConfig: BackupScheduleConfig;
  private scheduleTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private configService: ConfigService,
    @Inject(forwardRef(() => WebhookService))
    private webhookService: WebhookService,
  ) {
    this.backupDir =
      configService.get<string>('backup.dir') ??
      (process.env.NODE_ENV === 'production'
        ? '/backups'
        : join(process.cwd(), 'backups'));
    this.dbHost = configService.get<string>('DB_HOST', 'localhost');
    this.dbPort = configService.get<string>('DB_PORT', '3306');
    this.dbUser = configService.get<string>('DB_USER', 'root');
    this.dbPassword = configService.get<string>('DB_ROOT_PASSWORD', 'password');
    this.retentionDays = configService.get<number>('backup.retentionDays', 30);
    this.scheduleConfig = {
      enabled: false,
      cron: '0 3 * * *',
      databases: ['acore_auth', 'acore_characters'],
      retentionDays: this.retentionDays,
    };
  }

  async onModuleInit() {
    await fs.mkdir(this.backupDir, { recursive: true });
    await this.loadScheduleConfig();
  }

  async triggerBackup(databases: string[]) {
    for (const db of databases) {
      if (!ALLOWED_DATABASES.includes(db)) {
        throw new BadRequestException(`Invalid database name: ${db}`);
      }
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const results = [];

    for (const db of databases) {
      const filename = `${db}_${timestamp}.sql.gz`;
      const filePath = join(this.backupDir, filename);

      try {
        await this.execDump(db, filePath);

        const stat = await fs.stat(filePath);
        if (stat.size <= MIN_VALID_BACKUP_SIZE) {
          await fs.unlink(filePath).catch(() => {});
          throw new Error(
            `Backup file too small (${stat.size} bytes) — dump likely failed`,
          );
        }
        results.push({
          filename,
          database: db,
          size: stat.size,
          success: true,
        });
      } catch (error) {
        this.logger.error(`Backup failed for ${db}: ${error}`);
        await fs.unlink(filePath).catch(() => {});
        results.push({ filename, database: db, size: 0, success: false });
      }
    }

    await this.cleanOldBackups();

    const allSucceeded = results.every((r) => r.success);
    if (allSucceeded) {
      this.webhookService.sendNotification(
        'backup_success',
        'info',
        'Backup completed',
        `Databases: ${databases.join(', ')}`,
      );
    } else {
      const failed = results.filter((r) => !r.success).map((r) => r.database);
      this.webhookService.sendNotification(
        'backup_failed',
        'high',
        'Backup failed',
        `Failed databases: ${failed.join(', ')}`,
      );
    }

    return results;
  }

  private execDump(db: string, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const settle = (err?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        conn.destroy();
        if (err) reject(err);
        else resolve();
      };

      const conn = mysql.createConnection({
        host: this.dbHost,
        port: Number(this.dbPort),
        user: this.dbUser,
        password: this.dbPassword,
        database: db,
        dateStrings: true,
        bigNumberStrings: true,
      });

      const timer = setTimeout(() => {
        settle(new Error(`Backup timed out after ${DUMP_TIMEOUT_MS}ms`));
      }, DUMP_TIMEOUT_MS);

      const gzip = createGzip();
      const outStream = createWriteStream(filePath);
      gzip.pipe(outStream);

      outStream.on('error', (err) => settle(err));
      gzip.on('error', (err) => settle(err));

      conn.connect((connErr) => {
        if (connErr) return settle(connErr);

        this.writeDump(conn, db, gzip)
          .then(() => {
            gzip.end(() => settle());
          })
          .catch((err) => settle(err));
      });
    });
  }

  private async writeDump(
    conn: mysql.Connection,
    db: string,
    out: NodeJS.WritableStream,
  ): Promise<void> {
    out.write(
      `-- Pure Node.js dump of ${db}\n` +
        `-- Generated: ${new Date().toISOString()}\n\n` +
        `/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;\n` +
        `/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;\n` +
        `/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;\n` +
        `/*!40101 SET NAMES utf8mb4 */;\n` +
        `/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;\n` +
        `/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;\n` +
        `/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;\n\n`,
    );

    const tables = await this.queryPromise<Array<Record<string, string>>>(
      conn,
      'SHOW TABLES',
    );

    for (const row of tables) {
      const tableName = Object.values(row)[0];
      await this.dumpTable(conn, tableName, out);
    }

    out.write(
      `\n/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;\n` +
        `/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;\n` +
        `/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;\n` +
        `/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;\n` +
        `/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;\n` +
        `/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;\n`,
    );
  }

  private async dumpTable(
    conn: mysql.Connection,
    table: string,
    out: NodeJS.WritableStream,
  ): Promise<void> {
    const escapedTable = conn.escapeId(table);

    const createResult = await this.queryPromise<Array<Record<string, string>>>(
      conn,
      `SHOW CREATE TABLE ${escapedTable}`,
    );
    const createSql = createResult[0]?.['Create Table'];
    if (!createSql) return;

    out.write(`--\n-- Table structure for table ${escapedTable}\n--\n\n`);
    out.write(`DROP TABLE IF EXISTS ${escapedTable};\n`);
    out.write(`${createSql};\n\n`);

    out.write(`LOCK TABLES ${escapedTable} WRITE;\n`);
    await this.streamTableData(conn, table, out);
    out.write(`UNLOCK TABLES;\n\n`);
  }

  private streamTableData(
    conn: mysql.Connection,
    table: string,
    out: NodeJS.WritableStream,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const escapedTable = conn.escapeId(table);
      const query = conn.query(`SELECT * FROM ${escapedTable}`);
      const stream = query.stream();

      let batch: string[] = [];
      let hasData = false;

      stream.on('data', (row: Record<string, unknown>) => {
        hasData = true;
        batch.push(
          `(${Object.values(row).map((v) => this.escapeValue(v)).join(',')})`,
        );

        if (batch.length >= INSERT_BATCH_SIZE) {
          const sql = `INSERT INTO ${escapedTable} VALUES\n${batch.join(',\n')};\n`;
          batch = [];
          if (!out.write(sql)) {
            stream.pause();
            out.once('drain', () => stream.resume());
          }
        }
      });

      stream.on('end', () => {
        if (batch.length > 0) {
          out.write(
            `INSERT INTO ${escapedTable} VALUES\n${batch.join(',\n')};\n`,
          );
        }
        if (!hasData) {
          out.write(`-- No data for table ${escapedTable}\n`);
        }
        resolve();
      });

      stream.on('error', reject);
    });
  }

  private escapeValue(value: unknown): string {
    if (value === null || value === undefined) return 'NULL';
    if (Buffer.isBuffer(value))
      return `X'${(value as Buffer).toString('hex')}'`;
    return mysql.escape(value);
  }

  private queryPromise<T>(conn: mysql.Connection, sql: string): Promise<T> {
    return new Promise((resolve, reject) => {
      conn.query(sql, (err, results) => {
        if (err) reject(err);
        else resolve(results as T);
      });
    });
  }

  async listBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const backups = [];

      for (const file of files) {
        if (!file.endsWith('.sql.gz')) continue;
        const stat = await fs.stat(join(this.backupDir, file));
        backups.push({
          filename: file,
          size: stat.size,
          createdAt: stat.mtime,
        });
      }

      return backups.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );
    } catch {
      return [];
    }
  }

  getBackupPath(filename: string): string {
    assertSafeFilename(filename);
    return join(this.backupDir, filename);
  }

  async deleteBackup(filename: string) {
    assertSafeFilename(filename);
    await fs.unlink(join(this.backupDir, filename));
    return { message: 'Backup deleted' };
  }

  async getSchedule(): Promise<BackupScheduleConfig> {
    return this.scheduleConfig;
  }

  async setSchedule(config: BackupScheduleConfig) {
    if (config.retentionDays < 1) {
      throw new BadRequestException('Retention days must be at least 1');
    }
    this.scheduleConfig = config;
    await this.saveScheduleConfig();
    this.setupScheduleTimer();
    return this.scheduleConfig;
  }

  private async loadScheduleConfig() {
    try {
      const data = await fs.readFile(
        join(this.backupDir, 'schedule.json'),
        'utf-8',
      );
      this.scheduleConfig = JSON.parse(data);
      this.setupScheduleTimer();
    } catch {
      // No schedule config yet, use defaults
    }
  }

  private async saveScheduleConfig() {
    await fs.writeFile(
      join(this.backupDir, 'schedule.json'),
      JSON.stringify(this.scheduleConfig, null, 2),
    );
  }

  private setupScheduleTimer() {
    if (this.scheduleTimer) {
      clearInterval(this.scheduleTimer);
      this.scheduleTimer = null;
    }

    if (!this.scheduleConfig.enabled) return;

    // Simple interval-based scheduling (check every minute)
    this.scheduleTimer = setInterval(() => {
      const now = new Date();
      if (this.matchesCron(now, this.scheduleConfig.cron)) {
        this.triggerBackup(this.scheduleConfig.databases).catch((err) =>
          this.logger.error(`Scheduled backup failed: ${err}`),
        );
      }
    }, SCHEDULE_CHECK_INTERVAL_MS);
  }

  private matchesCron(date: Date, cron: string): boolean {
    const parts = cron.split(' ');
    if (parts.length < 5) return false;
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    return (
      this.cronFieldMatches(minute, date.getMinutes()) &&
      this.cronFieldMatches(hour, date.getHours()) &&
      this.cronFieldMatches(dayOfMonth, date.getDate()) &&
      this.cronFieldMatches(month, date.getMonth() + 1) &&
      this.cronFieldMatches(dayOfWeek, date.getDay())
    );
  }

  private cronFieldMatches(field: string, value: number): boolean {
    if (field === '*') return true;
    // Handle step values: */5
    if (field.startsWith('*/')) {
      const step = parseInt(field.slice(2), 10);
      return step > 0 && value % step === 0;
    }
    // Handle comma-separated: 1,15,30
    return field.split(',').some((part) => {
      // Handle ranges: 1-5
      if (part.includes('-')) {
        const [min, max] = part.split('-').map((n) => parseInt(n, 10));
        return (
          min !== undefined && max !== undefined && value >= min && value <= max
        );
      }
      return parseInt(part, 10) === value;
    });
  }

  private async cleanOldBackups() {
    const backups = await this.listBackups();
    const cutoff = Date.now() - this.scheduleConfig.retentionDays * 86400000;

    for (const backup of backups) {
      if (backup.createdAt.getTime() < cutoff) {
        try {
          await fs.unlink(join(this.backupDir, backup.filename));
          this.logger.log(`Deleted old backup: ${backup.filename}`);
        } catch (error) {
          this.logger.error(`Failed to delete old backup: ${error}`);
        }
      }
    }
  }
}
