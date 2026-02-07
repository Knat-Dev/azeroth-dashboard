import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

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
  private readonly dbPassword: string;
  private readonly retentionDays: number;
  private scheduleConfig: BackupScheduleConfig;
  private scheduleTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private configService: ConfigService) {
    this.backupDir = configService.get<string>('backup.dir', '/backups');
    this.dbHost = configService.get<string>('DB_HOST', 'localhost');
    this.dbPort = configService.get<string>('DB_PORT', '3306');
    this.dbPassword = configService.get<string>('DB_ROOT_PASSWORD', 'password');
    this.retentionDays = configService.get<number>(
      'backup.retentionDays',
      30,
    );
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
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const results = [];

    for (const db of databases) {
      const filename = `${db}_${timestamp}.sql.gz`;
      const filePath = join(this.backupDir, filename);

      try {
        await execAsync(
          `mysqldump -h ${this.dbHost} -P ${this.dbPort} -u root -p'${this.dbPassword}' ${db} | gzip > '${filePath}'`,
          { timeout: 300000 },
        );

        const stat = await fs.stat(filePath);
        results.push({
          filename,
          database: db,
          size: stat.size,
          success: true,
        });
      } catch (error) {
        this.logger.error(`Backup failed for ${db}: ${error}`);
        results.push({ filename, database: db, size: 0, success: false });
      }
    }

    await this.cleanOldBackups();
    return results;
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
    return join(this.backupDir, filename);
  }

  async deleteBackup(filename: string) {
    await fs.unlink(join(this.backupDir, filename));
    return { message: 'Backup deleted' };
  }

  async getSchedule(): Promise<BackupScheduleConfig> {
    return this.scheduleConfig;
  }

  async setSchedule(config: BackupScheduleConfig) {
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
    this.scheduleTimer = setInterval(
      () => {
        const now = new Date();
        if (this.matchesCron(now, this.scheduleConfig.cron)) {
          this.triggerBackup(this.scheduleConfig.databases).catch((err) =>
            this.logger.error(`Scheduled backup failed: ${err}`),
          );
        }
      },
      60 * 1000,
    );
  }

  private matchesCron(date: Date, cron: string): boolean {
    const [minute, hour] = cron.split(' ');
    return (
      date.getSeconds() === 0 &&
      (minute === '*' || parseInt(minute!, 10) === date.getMinutes()) &&
      (hour === '*' || parseInt(hour!, 10) === date.getHours())
    );
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
