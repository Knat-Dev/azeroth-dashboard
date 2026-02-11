import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
  forwardRef,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs, createWriteStream, createReadStream } from 'fs';
import { join } from 'path';
import { createGzip, createGunzip } from 'zlib';
import mysql from 'mysql2';
import { WebhookService } from '../webhook/webhook.service.js';
import { DockerService } from '../docker/docker.service.js';
import { MonitorService } from '../monitor/monitor.service.js';
import type { BackupSet, BackupSetFile, SetValidationResult, SetRestoreResult, RestoreProgress, RestoreStep, RestoreStepStatus } from '@repo/shared';
import * as crypto from 'crypto';
import { NotFoundException } from '@nestjs/common';

const ALLOWED_DATABASES = [
  'acore_auth',
  'acore_characters',
  'acore_playerbots',
  'acore_world',
];
const DUMP_TIMEOUT_MS = 300_000; // 5 minutes
const RESTORE_TIMEOUT_MS = 600_000; // 10 minutes
const SCHEDULE_CHECK_INTERVAL_MS = 60_000; // 1 minute
const MIN_VALID_BACKUP_SIZE = 100; // bytes
const INSERT_BATCH_SIZE = 500;
const SERVER_STOP_TIMEOUT_S = 120;
const STOP_MAX_RETRIES = 2;
const SERVER_SETTLE_MS = 3000;

const ALLOWED_STATEMENT_PREFIXES = [
  'DROP TABLE IF EXISTS',
  'CREATE TABLE',
  'INSERT INTO',
  'LOCK TABLES',
  'UNLOCK TABLES',
  '/*!',
];

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

/**
 * Parse a backup filename into its components.
 * Matches `{db}_pre-restore_{timestamp}.sql.gz`, `{db}_scheduled_{timestamp}.sql.gz`,
 * or `{db}_{timestamp}.sql.gz`.
 */
export function parseBackupFilename(filename: string): {
  database: string;
  timestamp: string;
  isPreRestore: boolean;
  isScheduled: boolean;
} | null {
  // Try pre-restore pattern first (most specific)
  for (const db of ALLOWED_DATABASES) {
    const preRestorePrefix = `${db}_pre-restore_`;
    if (filename.startsWith(preRestorePrefix) && filename.endsWith('.sql.gz')) {
      const timestamp = filename.slice(preRestorePrefix.length, -'.sql.gz'.length);
      if (timestamp) return { database: db, timestamp, isPreRestore: true, isScheduled: false };
    }
  }
  // Try scheduled pattern
  for (const db of ALLOWED_DATABASES) {
    const scheduledPrefix = `${db}_scheduled_`;
    if (filename.startsWith(scheduledPrefix) && filename.endsWith('.sql.gz')) {
      const timestamp = filename.slice(scheduledPrefix.length, -'.sql.gz'.length);
      if (timestamp) return { database: db, timestamp, isPreRestore: false, isScheduled: true };
    }
  }
  // Try normal pattern
  for (const db of ALLOWED_DATABASES) {
    const prefix = `${db}_`;
    if (filename.startsWith(prefix) && filename.endsWith('.sql.gz')) {
      const timestamp = filename.slice(prefix.length, -'.sql.gz'.length);
      if (timestamp && !timestamp.includes('pre-restore') && !timestamp.includes('scheduled')) return { database: db, timestamp, isPreRestore: false, isScheduled: false };
    }
  }
  return null;
}

/**
 * Streaming SQL parser that correctly handles semicolons inside single-quoted strings.
 * Maintains state across chunks so it works with streaming decompression.
 */
export class SqlStatementParser {
  private buffer = '';
  private inString = false;
  private escaped = false;

  /** Feed a chunk of SQL text, returns complete statements found. */
  feed(chunk: string): string[] {
    const statements: string[] = [];

    for (const char of chunk) {
      if (this.escaped) {
        this.buffer += char;
        this.escaped = false;
        continue;
      }

      if (char === '\\' && this.inString) {
        this.buffer += char;
        this.escaped = true;
        continue;
      }

      if (char === "'") {
        this.inString = !this.inString;
        this.buffer += char;
        continue;
      }

      if (char === ';' && !this.inString) {
        const stmt = this.buffer.trim();
        if (stmt && !this.isCommentOnly(stmt)) {
          statements.push(stmt);
        }
        this.buffer = '';
        continue;
      }

      this.buffer += char;
    }

    return statements;
  }

  /** Return any remaining buffered statement. */
  flush(): string[] {
    const stmt = this.buffer.trim();
    this.buffer = '';
    this.inString = false;
    this.escaped = false;
    if (stmt && !this.isCommentOnly(stmt)) {
      return [stmt];
    }
    return [];
  }

  private isCommentOnly(stmt: string): boolean {
    const lines = stmt.split('\n');
    return lines.every(
      (line) => line.trim() === '' || line.trim().startsWith('--'),
    );
  }
}

/** Check if a SQL statement is allowed for restore. */
export function isAllowedStatement(stmt: string): boolean {
  // Strip leading comment lines to find the first real SQL line
  const lines = stmt.split('\n');
  let firstSqlLine = '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('--')) continue;
    firstSqlLine = trimmed;
    break;
  }

  if (!firstSqlLine) return false;

  const upper = firstSqlLine.toUpperCase();
  return ALLOWED_STATEMENT_PREFIXES.some((prefix) =>
    upper.startsWith(prefix.toUpperCase()),
  );
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
  private scheduleConfig: BackupScheduleConfig | null = null;
  private scheduleTimer: ReturnType<typeof setInterval> | null = null;

  private readonly busyDatabases = new Set<string>();
  private readonly restoreOperations = new Map<string, RestoreProgress>();
  private readonly cancelledOps = new Set<string>();

  constructor(
    private configService: ConfigService,
    @Inject(forwardRef(() => WebhookService))
    private webhookService: WebhookService,
    private dockerService: DockerService,
    @Inject(forwardRef(() => MonitorService))
    private monitorService: MonitorService,
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
  }

  async onModuleInit() {
    await fs.mkdir(this.backupDir, { recursive: true });
    await this.loadScheduleConfig();
  }

  async triggerBackup(databases: string[], source: 'manual' | 'scheduled' = 'manual') {
    for (const db of databases) {
      if (!ALLOWED_DATABASES.includes(db)) {
        throw new BadRequestException(`Invalid database name: ${db}`);
      }
    }

    // Acquire locks for all requested databases
    for (const db of databases) {
      this.acquireLock(db);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const infix = source === 'scheduled' ? '_scheduled_' : '_';
    const results = [];

    try {
      for (const db of databases) {
        const filename = `${db}${infix}${timestamp}.sql.gz`;
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
    } finally {
      for (const db of databases) {
        this.releaseLock(db);
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

  async listBackups(): Promise<BackupSet[]> {
    try {
      const files = await fs.readdir(this.backupDir);
      const setMap = new Map<string, { files: BackupSetFile[]; isPreRestore: boolean; isScheduled: boolean }>();

      for (const file of files) {
        if (!file.endsWith('.sql.gz')) continue;
        const parsed = parseBackupFilename(file);
        if (!parsed) continue;

        const stat = await fs.stat(join(this.backupDir, file));
        const prefix = parsed.isPreRestore ? 'pre-restore_' : parsed.isScheduled ? 'scheduled_' : '';
        const key = `${prefix}${parsed.timestamp}`;

        if (!setMap.has(key)) {
          setMap.set(key, { files: [], isPreRestore: parsed.isPreRestore, isScheduled: parsed.isScheduled });
        }
        setMap.get(key)!.files.push({
          filename: file,
          database: parsed.database,
          size: stat.size,
        });
      }

      const sets: BackupSet[] = [];
      for (const [key, entry] of setMap) {
        const prefixLen = entry.isPreRestore ? 'pre-restore_'.length : entry.isScheduled ? 'scheduled_'.length : 0;
        const timestamp = key.slice(prefixLen);
        const createdAt = timestamp.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/, 'T$1:$2:$3.$4Z');
        sets.push({
          id: key,
          createdAt,
          databases: entry.files.map((f) => f.database).sort(),
          files: entry.files,
          totalSize: entry.files.reduce((sum, f) => sum + f.size, 0),
          isPreRestore: entry.isPreRestore,
          label: entry.isPreRestore ? 'Pre-restore backup' : entry.isScheduled ? 'Scheduled backup' : 'Manual backup',
        });
      }

      return sets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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

  async getSet(setId: string): Promise<BackupSet> {
    const sets = await this.listBackups();
    const set = sets.find((s) => s.id === setId);
    if (!set) {
      throw new NotFoundException(`Backup set "${setId}" not found`);
    }
    return set;
  }

  async deleteSet(setId: string): Promise<{ deleted: number }> {
    const set = await this.getSet(setId);
    for (const file of set.files) {
      await fs.unlink(join(this.backupDir, file.filename));
    }
    return { deleted: set.files.length };
  }

  async validateSet(setId: string): Promise<SetValidationResult> {
    const set = await this.getSet(setId);
    const fileResults: SetValidationResult['files'] = [];
    let generatedAt: string | null = null;

    for (const file of set.files) {
      const validation = await this.validateDumpFile(file.filename);
      fileResults.push({
        filename: file.filename,
        database: file.database,
        valid: validation.valid,
        tableCount: validation.tableCount,
        statementCount: validation.statementCount,
        tables: validation.tables,
        errors: validation.errors,
      });
      if (!generatedAt && validation.generatedAt) {
        generatedAt = validation.generatedAt;
      }
    }

    return {
      valid: fileResults.every((f) => f.valid),
      setId,
      files: fileResults,
      generatedAt,
    };
  }

  async getSchedule(): Promise<BackupScheduleConfig | null> {
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

  async deleteSchedule() {
    if (this.scheduleTimer) {
      clearInterval(this.scheduleTimer);
      this.scheduleTimer = null;
    }
    this.scheduleConfig = null;
    try {
      await fs.unlink(join(this.backupDir, 'schedule.json'));
    } catch {
      // File may not exist
    }
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

    if (!this.scheduleConfig?.enabled) return;

    const config = this.scheduleConfig;
    // Simple interval-based scheduling (check every minute)
    this.scheduleTimer = setInterval(() => {
      const now = new Date();
      if (this.matchesCron(now, config.cron)) {
        this.triggerBackup(config.databases, 'scheduled').catch((err) =>
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
      this.cronFieldMatches(minute, date.getUTCMinutes()) &&
      this.cronFieldMatches(hour, date.getUTCHours()) &&
      this.cronFieldMatches(dayOfMonth, date.getUTCDate()) &&
      this.cronFieldMatches(month, date.getUTCMonth() + 1) &&
      this.cronFieldMatches(dayOfWeek, date.getUTCDay())
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
    const sets = await this.listBackups();
    const cutoff = Date.now() - (this.scheduleConfig?.retentionDays ?? this.retentionDays) * 86400000;

    for (const set of sets) {
      if (new Date(set.createdAt).getTime() < cutoff) {
        for (const file of set.files) {
          try {
            await fs.unlink(join(this.backupDir, file.filename));
            this.logger.log(`Deleted old backup: ${file.filename}`);
          } catch (error) {
            this.logger.error(`Failed to delete old backup: ${error}`);
          }
        }
      }
    }
  }

  // ── Concurrency lock ────────────────────────────────────────────

  private acquireLock(db: string): void {
    if (this.busyDatabases.has(db)) {
      throw new ConflictException(
        `Database "${db}" is busy with another backup or restore operation`,
      );
    }
    this.busyDatabases.add(db);
  }

  private releaseLock(db: string): void {
    this.busyDatabases.delete(db);
  }

  // ── Restore: operation tracking ─────────────────────────────────

  private createOperation(setId: string, steps: RestoreStep[]): RestoreProgress {
    const operationId = crypto.randomUUID();
    const op: RestoreProgress = { operationId, setId, status: 'running', steps };
    this.restoreOperations.set(operationId, op);
    // Auto-cleanup after 1 hour (unref so it doesn't prevent process exit)
    const timer = setTimeout(() => this.restoreOperations.delete(operationId), 3600_000);
    if (typeof timer.unref === 'function') timer.unref();
    return op;
  }

  private updateStep(op: RestoreProgress, stepId: string, status: RestoreStepStatus, error?: string) {
    const step = op.steps.find(s => s.id === stepId);
    if (step) {
      step.status = status;
      if (error) step.error = error;
    }
  }

  getRestoreProgress(operationId: string): RestoreProgress | undefined {
    return this.restoreOperations.get(operationId);
  }

  cancelRestore(operationId: string): boolean {
    const op = this.restoreOperations.get(operationId);
    if (!op || op.status !== 'running') return false;
    this.cancelledOps.add(operationId);
    return true;
  }

  private checkCancelled(op: RestoreProgress): void {
    if (this.cancelledOps.has(op.operationId)) {
      throw new Error('Restore cancelled by user');
    }
  }

  // ── Restore: helpers ────────────────────────────────────────────

  private extractDatabaseFromFilename(filename: string): string {
    const parsed = parseBackupFilename(filename);
    if (parsed) return parsed.database;
    // Fallback to prefix matching
    for (const db of ALLOWED_DATABASES) {
      if (filename.startsWith(db)) return db;
    }
    throw new BadRequestException(
      `Cannot determine database from filename "${filename}". Expected prefix: ${ALLOWED_DATABASES.join(', ')}`,
    );
  }

  // ── Restore: validation (Pass 1) ───────────────────────────────

  async validateDumpFile(filename: string): Promise<{
    valid: boolean;
    database: string;
    filename: string;
    tableCount: number;
    statementCount: number;
    tables: string[];
    errors: string[];
    generatedAt: string | null;
  }> {
    assertSafeFilename(filename);
    const database = this.extractDatabaseFromFilename(filename);
    const filePath = join(this.backupDir, filename);

    await fs.access(filePath);

    const tables: string[] = [];
    const errors: string[] = [];
    let statementCount = 0;
    let generatedAt: string | null = null;

    return new Promise((resolve, reject) => {
      const readStream = createReadStream(filePath);
      const gunzip = createGunzip();
      const parser = new SqlStatementParser();

      let headerChecked = false;

      const processChunk = (chunk: Buffer) => {
        const text = chunk.toString('utf-8');

        // Extract generatedAt from header comment
        if (!headerChecked) {
          headerChecked = true;
          const match = text.match(/-- Generated:\s*(.+)/);
          if (match) generatedAt = match[1].trim();
        }

        const statements = parser.feed(text);
        for (const stmt of statements) {
          statementCount++;
          if (!isAllowedStatement(stmt)) {
            // Extract first non-comment line for error message
            const firstLine = stmt.split('\n').find(
              (l) => l.trim() && !l.trim().startsWith('--'),
            ) ?? stmt.slice(0, 80);
            errors.push(
              `Statement #${statementCount}: disallowed: ${firstLine.slice(0, 100)}`,
            );
            if (errors.length >= 20) {
              readStream.destroy();
              gunzip.destroy();
              resolve({
                valid: false,
                database,
                filename,
                tableCount: tables.length,
                statementCount,
                tables,
                errors,
                generatedAt,
              });
              return;
            }
          }

          // Track table names from DROP TABLE IF EXISTS
          const dropMatch = stmt.match(
            /DROP\s+TABLE\s+IF\s+EXISTS\s+`?(\w+)`?/i,
          );
          if (dropMatch) tables.push(dropMatch[1]);
        }
      };

      gunzip.on('data', processChunk);

      gunzip.on('end', () => {
        // Flush remaining buffer
        const remaining = parser.flush();
        for (const stmt of remaining) {
          statementCount++;
          if (!isAllowedStatement(stmt)) {
            const firstLine = stmt.split('\n').find(
              (l) => l.trim() && !l.trim().startsWith('--'),
            ) ?? stmt.slice(0, 80);
            errors.push(
              `Statement #${statementCount}: disallowed: ${firstLine.slice(0, 100)}`,
            );
          }
          const dropMatch = stmt.match(
            /DROP\s+TABLE\s+IF\s+EXISTS\s+`?(\w+)`?/i,
          );
          if (dropMatch) tables.push(dropMatch[1]);
        }

        if (statementCount === 0) {
          errors.push('Dump file contains no SQL statements');
        }

        resolve({
          valid: errors.length === 0,
          database,
          filename,
          tableCount: tables.length,
          statementCount,
          tables,
          errors,
          generatedAt,
        });
      });

      gunzip.on('error', (err) =>
        reject(new BadRequestException(`Failed to decompress: ${err.message}`)),
      );
      readStream.on('error', (err) =>
        reject(new BadRequestException(`Failed to read file: ${err.message}`)),
      );

      readStream.pipe(gunzip);
    });
  }

  // ── Restore: execution (Pass 2) ────────────────────────────────

  private execRestore(
    database: string,
    filePath: string,
  ): Promise<{ statementsExecuted: number; tablesRestored: number }> {
    return new Promise((resolve, reject) => {
      let settled = false;
      let statementsExecuted = 0;
      let tablesRestored = 0;
      let queued = 0;

      const conn = mysql.createConnection({
        host: this.dbHost,
        port: Number(this.dbPort),
        user: this.dbUser,
        password: this.dbPassword,
        database,
        dateStrings: true,
        bigNumberStrings: true,
        multipleStatements: false,
      });

      const timer = setTimeout(() => {
        settle(new Error(`Restore timed out after ${RESTORE_TIMEOUT_MS}ms`));
      }, RESTORE_TIMEOUT_MS);

      const settle = (err?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        conn.destroy();
        if (err) reject(err);
        else resolve({ statementsExecuted, tablesRestored });
      };

      conn.connect((connErr) => {
        if (connErr) return settle(connErr);

        const readStream = createReadStream(filePath);
        const gunzip = createGunzip();
        const parser = new SqlStatementParser();

        const executeNext = (statements: string[]) => {
          for (let stmt of statements) {
            // Use INSERT IGNORE to skip duplicate rows from dumps
            if (/^INSERT\s+INTO\s/i.test(stmt)) {
              stmt = stmt.replace(/^INSERT\s+INTO\s/i, 'INSERT IGNORE INTO ');
            }

            queued++;
            // Backpressure: pause gunzip if too many queued
            if (queued > 100 && !gunzip.isPaused?.()) {
              gunzip.pause();
            }

            conn.query(stmt, (queryErr) => {
              if (settled) return;
              if (queryErr) return settle(queryErr);

              statementsExecuted++;
              if (/^DROP\s+TABLE\s+IF\s+EXISTS/i.test(stmt)) {
                tablesRestored++;
              }

              queued--;
              if (queued <= 50 && gunzip.isPaused?.()) {
                gunzip.resume();
              }
            });
          }
        };

        gunzip.on('data', (chunk: Buffer) => {
          if (settled) return;
          const statements = parser.feed(chunk.toString('utf-8'));
          executeNext(statements);
        });

        gunzip.on('end', () => {
          if (settled) return;
          const remaining = parser.flush();
          if (remaining.length > 0) {
            executeNext(remaining);
          }
          // Wait for all queries to complete by issuing a final ping
          conn.query('SELECT 1', (err) => {
            if (settled) return;
            settle(err ?? undefined);
          });
        });

        gunzip.on('error', (err) => settle(err));
        readStream.on('error', (err) => settle(err));

        readStream.pipe(gunzip);
      });
    });
  }

  // ── Restore: server lifecycle ───────────────────────────────────

  private async stopServers(op?: RestoreProgress): Promise<void> {
    // Stop worldserver first — this triggers in-memory data flush to MySQL
    // Retry if it doesn't stop on the first attempt
    if (op) this.updateStep(op, 'stop_worldserver', 'in_progress');
    let wsStopped = false;
    for (let attempt = 0; attempt <= STOP_MAX_RETRIES; attempt++) {
      try {
        await this.dockerService.stopContainer(
          'ac-worldserver',
          SERVER_STOP_TIMEOUT_S,
        );
      } catch (err) {
        if (attempt === STOP_MAX_RETRIES) {
          if (op)
            this.updateStep(op, 'stop_worldserver', 'failed', String(err));
          throw new Error(
            `Failed to stop worldserver after ${attempt + 1} attempts: ${err}`,
          );
        }
        this.logger.warn(
          `Worldserver stop attempt ${attempt + 1} failed, retrying...`,
        );
        continue;
      }
      // Verify it actually stopped
      const state = await this.dockerService.getContainerState(
        'ac-worldserver',
      );
      if (state.state !== 'running') {
        wsStopped = true;
        break;
      }
      if (attempt < STOP_MAX_RETRIES) {
        this.logger.warn(
          `Worldserver still running after stop attempt ${attempt + 1}, retrying...`,
        );
      }
    }
    if (!wsStopped) {
      const msg = 'Worldserver still running after all stop attempts';
      if (op) this.updateStep(op, 'stop_worldserver', 'failed', msg);
      throw new Error(msg);
    }
    if (op) this.updateStep(op, 'stop_worldserver', 'done');

    if (op) this.updateStep(op, 'stop_authserver', 'in_progress');
    try {
      await this.dockerService.stopContainer(
        'ac-authserver',
        SERVER_STOP_TIMEOUT_S,
      );
      if (op) this.updateStep(op, 'stop_authserver', 'done');
    } catch (err) {
      if (op) this.updateStep(op, 'stop_authserver', 'failed', String(err));
      throw new Error(`Failed to stop authserver: ${err}`);
    }

    // Wait for processes to fully exit
    await this.sleep(SERVER_SETTLE_MS);

    // Verify both are actually stopped — CRITICAL
    if (op) this.updateStep(op, 'verify_stopped', 'in_progress');
    const [wsState, asState] = await Promise.all([
      this.dockerService.getContainerState('ac-worldserver'),
      this.dockerService.getContainerState('ac-authserver'),
    ]);
    this.logger.log(
      `Server states after stop: worldserver=${wsState.state}, authserver=${asState.state}`,
    );

    const wsRunning = wsState.state === 'running';
    const asRunning = asState.state === 'running';

    if (wsRunning || asRunning) {
      const msg = `Servers still running after stop: worldserver=${wsState.state}, authserver=${asState.state}. Aborting restore.`;
      if (op) this.updateStep(op, 'verify_stopped', 'failed', msg);
      throw new Error(msg);
    }
    if (op) this.updateStep(op, 'verify_stopped', 'done');
  }

  private async startServers(op?: RestoreProgress): Promise<void> {
    // Start authserver first — worldserver depends on it
    if (op) this.updateStep(op, 'start_authserver', 'in_progress');
    try {
      await this.dockerService.startContainer('ac-authserver');
      if (op) this.updateStep(op, 'start_authserver', 'done');
    } catch (err) {
      this.logger.warn(`Failed to start ac-authserver: ${err}`);
      if (op) this.updateStep(op, 'start_authserver', 'failed', String(err));
    }

    await this.sleep(SERVER_SETTLE_MS);

    if (op) this.updateStep(op, 'start_worldserver', 'in_progress');
    try {
      await this.dockerService.startContainer('ac-worldserver');
      if (op) this.updateStep(op, 'start_worldserver', 'done');
    } catch (err) {
      this.logger.warn(`Failed to start ac-worldserver: ${err}`);
      if (op) this.updateStep(op, 'start_worldserver', 'failed', String(err));
    }

    // Clear crash-loop flags so monitor doesn't think they're crashing
    this.monitorService.clearCrashLoop('ac-worldserver');
    this.monitorService.clearCrashLoop('ac-authserver');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ── Restore: main orchestrator ──────────────────────────────────

  async restoreSet(setId: string): Promise<{ operationId: string }> {
    const set = await this.getSet(setId);
    const databases = set.databases;

    // Pass 1: Validate all files (synchronous, before returning)
    for (const file of set.files) {
      const validation = await this.validateDumpFile(file.filename);
      if (!validation.valid) {
        throw new BadRequestException(
          `Validation failed for ${file.filename}: ${validation.errors.join('; ')}`,
        );
      }
    }

    // Acquire locks for all databases
    for (const db of databases) {
      this.acquireLock(db);
    }

    // Build step list dynamically based on set contents
    const steps: RestoreStep[] = [
      { id: 'stop_worldserver', label: 'Stopping worldserver', status: 'pending' },
      { id: 'stop_authserver', label: 'Stopping authserver', status: 'pending' },
      { id: 'verify_stopped', label: 'Verifying servers stopped', status: 'pending' },
      ...set.files.map(f => ({
        id: `pre_backup_${f.database}`, label: `Pre-backup ${f.database}`, status: 'pending' as const,
      })),
      ...set.files.map(f => ({
        id: `restore_${f.database}`, label: `Restoring ${f.database}`, status: 'pending' as const,
      })),
      { id: 'start_authserver', label: 'Starting authserver', status: 'pending' },
      { id: 'start_worldserver', label: 'Starting worldserver', status: 'pending' },
    ];

    const op = this.createOperation(setId, steps);

    // Fire-and-forget the actual restore
    this.executeRestore(op, set).catch(err => {
      this.logger.error(`Unhandled error in restore operation ${op.operationId}: ${err}`);
    });

    return { operationId: op.operationId };
  }

  private async executeRestore(op: RestoreProgress, set: BackupSet): Promise<void> {
    const startTime = Date.now();
    const databases = set.databases;

    let preRestoreSetId: string | null = null;
    const errors: { database: string; error: string }[] = [];
    let totalTablesRestored = 0;
    let totalStatementsExecuted = 0;
    let filesRestored = 0;

    try {
      // Suppress auto-restart so monitor doesn't fight us
      this.monitorService.suppressAutoRestart();

      // Stop game servers (single cycle for all databases)
      await this.stopServers(op);
      this.checkCancelled(op);

      // Pre-restore backup for all databases in the set
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      preRestoreSetId = `pre-restore_${timestamp}`;
      for (const file of set.files) {
        this.checkCancelled(op);
        const stepId = `pre_backup_${file.database}`;
        this.updateStep(op, stepId, 'in_progress');
        const preBackupFilename = `${file.database}_pre-restore_${timestamp}.sql.gz`;
        const preBackupPath = join(this.backupDir, preBackupFilename);
        try {
          await this.execDump(file.database, preBackupPath);
          const stat = await fs.stat(preBackupPath);
          if (stat.size <= MIN_VALID_BACKUP_SIZE) {
            throw new Error('Pre-restore backup too small');
          }
          this.logger.log(`Pre-restore backup created: ${preBackupFilename}`);
          this.updateStep(op, stepId, 'done');
        } catch (err) {
          this.logger.error(`Pre-restore backup failed for ${file.database}: ${err}`);
          this.updateStep(op, stepId, 'failed', String(err));
          throw new Error(
            `Pre-restore backup failed for ${file.database} — aborting restore. Error: ${err}`,
          );
        }
      }

      // Pass 2: Execute restore for each file (continue on error)
      for (const file of set.files) {
        this.checkCancelled(op);
        const stepId = `restore_${file.database}`;
        this.updateStep(op, stepId, 'in_progress');
        const filePath = join(this.backupDir, file.filename);
        try {
          const result = await this.execRestore(file.database, filePath);
          totalStatementsExecuted += result.statementsExecuted;
          totalTablesRestored += result.tablesRestored;
          filesRestored++;
          this.logger.log(
            `Restore completed for ${file.database}: ${result.statementsExecuted} statements, ${result.tablesRestored} tables`,
          );
          this.updateStep(op, stepId, 'done');
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          errors.push({ database: file.database, error: errorMsg });
          this.logger.error(`Restore failed for ${file.database}: ${errorMsg}`);
          this.updateStep(op, stepId, 'failed', errorMsg);
        }
      }
    } catch (err) {
      // Catch server stop failure, pre-restore backup failure, cancellation, or other setup errors
      const errorMsg = err instanceof Error ? err.message : String(err);
      errors.push({ database: 'setup', error: errorMsg });
    } finally {
      this.cancelledOps.delete(op.operationId);
      // Always restart servers and resume auto-restart
      await this.startServers(op);
      this.monitorService.resumeAutoRestart();
      for (const db of databases) {
        this.releaseLock(db);
      }
    }

    const durationMs = Date.now() - startTime;
    const success = errors.length === 0;

    // Send webhook
    if (success) {
      this.webhookService.sendNotification(
        'restore_success',
        'info',
        `Databases restored: ${databases.join(', ')}`,
        `Set: ${set.id}, ${totalTablesRestored} tables, ${totalStatementsExecuted} statements in ${Math.round(durationMs / 1000)}s`,
      );
    } else {
      this.webhookService.sendNotification(
        'restore_failed',
        'high',
        `Restore failed for set ${set.id}`,
        `Errors: ${errors.map((e) => `${e.database}: ${e.error}`).join('; ')}${preRestoreSetId ? `. Pre-restore set: ${preRestoreSetId}` : ''}`,
      );
    }

    const result: SetRestoreResult = {
      success,
      setId: set.id,
      databases,
      filesRestored,
      totalTablesRestored,
      totalStatementsExecuted,
      preRestoreSetId,
      durationMs,
      errors,
    };

    op.result = result;
    const wasCancelled = errors.some(e => e.error === 'Restore cancelled by user');
    op.status = wasCancelled ? 'cancelled' : success ? 'completed' : 'failed';
  }
}
