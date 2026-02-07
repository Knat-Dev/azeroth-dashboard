import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Log } from '../../entities/auth/log.entity.js';
import { LogIpAction } from '../../entities/auth/log-ip-action.entity.js';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { join } from 'path';

@Injectable()
export class LogsService {
  private readonly logsDir: string;

  constructor(
    @InjectRepository(Log, 'auth')
    private logRepo: Repository<Log>,
    @InjectRepository(LogIpAction, 'auth')
    private ipActionRepo: Repository<LogIpAction>,
    private configService: ConfigService,
  ) {
    this.logsDir = configService.get<string>('logs.dir', '/logs');
  }

  async queryLogs(options: {
    page?: number;
    limit?: number;
    level?: number;
    type?: string;
  }) {
    const page = options.page ?? 1;
    const limit = options.limit ?? 50;

    const qb = this.logRepo.createQueryBuilder('log');

    if (options.level !== undefined) {
      qb.andWhere('log.level = :level', { level: options.level });
    }
    if (options.type) {
      qb.andWhere('log.type = :type', { type: options.type });
    }

    qb.orderBy('log.time', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async queryIpActions(options: {
    page?: number;
    limit?: number;
    accountId?: number;
    ip?: string;
  }) {
    const page = options.page ?? 1;
    const limit = options.limit ?? 50;

    const qb = this.ipActionRepo.createQueryBuilder('log');

    if (options.accountId) {
      qb.andWhere('log.account_id = :accountId', {
        accountId: options.accountId,
      });
    }
    if (options.ip) {
      qb.andWhere('log.ip = :ip', { ip: options.ip });
    }

    qb.orderBy('log.unixtime', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async readLogFile(filename: string, lines = 200) {
    const allowedFiles = ['Server.log', 'Auth.log', 'Errors.log'];
    if (!allowedFiles.includes(filename)) {
      return { error: 'File not allowed' };
    }

    const filePath = join(this.logsDir, filename);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const allLines = content.split('\n');
      return {
        lines: allLines.slice(-lines),
        totalLines: allLines.length,
      };
    } catch {
      return { lines: [], totalLines: 0, error: 'File not found or not accessible' };
    }
  }
}
