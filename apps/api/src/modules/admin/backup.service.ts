import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
  forwardRef,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn, type ChildProcess } from 'child_process';
import { promises as fs, createWriteStream } from 'fs';
import { join } from 'path';
import { WebhookService } from '../webhook/webhook.service.js';

const ALLOWED_DATABASES = [
  'acore_auth',
  'acore_characters',
  'acore_playerbots',
  'acore_world',
];
const MYSQLDUMP_TIMEOUT_MS = 300_000; // 5 minutes
const SCHEDULE_CHECK_INTERVAL_MS = 60_000; // 1 minute
const MIN_VALID_BACKUP_SIZE = 100; // bytes

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
        await this.execMysqldump(db, filePath);

        const stat = await fs.stat(filePath);
        if (stat.size <= MIN_VALID_BACKUP_SIZE) {
          await fs.unlink(filePath).catch(() => {});
          throw new Error(
            `Backup file too small (${stat.size} bytes) — mysqldump likely failed`,
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

  private execMysqldump(db: string, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        dump.kill();
        gzip.kill();
        reject(new Error(`Backup timed out after ${MYSQLDUMP_TIMEOUT_MS}ms`));
      }, MYSQLDUMP_TIMEOUT_MS);

      const dump = spawn('mysqldump', [
        '--protocol=tcp',
        '-h',
        this.dbHost,
        '-P',
        this.dbPort,
        '-u',
        this.dbUser,
        `-p${this.dbPassword}`,
        db,
      ]);

      const gzip = spawn('gzip');
      const outStream = createWriteStream(filePath);

      dump.stdout.pipe(gzip.stdin);
      gzip.stdout.pipe(outStream);

      const stderrChunks: Buffer[] = [];
      dump.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

      dump.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
      gzip.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });

      outStream.on('finish', () => {
        clearTimeout(timer);
        if (dump.exitCode !== 0) {
          const stderr = Buffer.concat(stderrChunks).toString().trim();
          reject(
            new Error(`mysqldump exited with code ${dump.exitCode}: ${stderr}`),
          );
        } else {
          resolve();
        }
      });

      outStream.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
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
