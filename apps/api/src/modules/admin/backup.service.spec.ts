import { BadRequestException } from '@nestjs/common';
import { EventEmitter } from 'events';
import { BackupService, BackupScheduleConfig } from './backup.service';
import { createMockConfigService } from '../../shared/test-utils';

// Use var so the factory closures can reference them (var is hoisted, const/let are not)
/* eslint-disable no-var */
var mockCreateConnection: jest.Mock;
var mockEscape: jest.Mock;
var mockCreateGzip: jest.Mock;
var mockFsPromises: Record<string, jest.Mock>;
var mockCreateWriteStream: jest.Mock;
/* eslint-enable no-var */

jest.mock('mysql2', () => {
  mockCreateConnection = jest.fn();
  mockEscape = jest.fn((v: unknown) => {
    if (typeof v === 'string') return `'${v}'`;
    return String(v);
  });
  return {
    __esModule: true,
    default: {
      createConnection: mockCreateConnection,
      escape: mockEscape,
    },
    createConnection: mockCreateConnection,
    escape: mockEscape,
  };
});

jest.mock('zlib', () => {
  const actual = jest.requireActual('zlib');
  mockCreateGzip = jest.fn();
  return { ...actual, createGzip: mockCreateGzip };
});

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  mockFsPromises = {
    mkdir: jest.fn().mockResolvedValue(undefined),
    stat: jest.fn(),
    unlink: jest.fn().mockResolvedValue(undefined),
    readdir: jest.fn().mockResolvedValue([]),
    readFile: jest.fn(),
    writeFile: jest.fn().mockResolvedValue(undefined),
  };
  mockCreateWriteStream = jest.fn();
  return {
    ...actual,
    promises: mockFsPromises,
    createWriteStream: mockCreateWriteStream,
  };
});

/** Create a mock mysql2 connection */
function createMockConnection(options: { connectError?: Error } = {}) {
  const queryStream = Object.assign(new EventEmitter(), {
    pause: jest.fn(),
    resume: jest.fn(),
  });

  const conn = {
    connect: jest.fn((cb: (err?: Error) => void) => {
      if (options.connectError) cb(options.connectError);
      else cb();
    }),
    query: jest.fn((...args: any[]) => {
      // If called with a callback (queryPromise style), handle it
      const lastArg = args[args.length - 1];
      if (typeof lastArg === 'function') {
        // Default: return empty results. Tests override via mockImplementation.
        return undefined;
      }
      // Streaming style: return object with .stream()
      return { stream: () => queryStream };
    }),
    escapeId: jest.fn((id: string) => `\`${id}\``),
    destroy: jest.fn(),
  };

  return { conn, queryStream };
}

/** Create a mock gzip transform stream */
function createMockGzipStream() {
  const gzipStream = Object.assign(new EventEmitter(), {
    write: jest.fn().mockReturnValue(true),
    end: jest.fn((cb?: () => void) => {
      if (cb) cb();
    }),
    pipe: jest.fn(),
  });
  return gzipStream;
}

/** Create a mock writable stream for file output */
function createMockFileStream() {
  return Object.assign(new EventEmitter(), {
    write: jest.fn(),
    end: jest.fn(),
  });
}

/**
 * Set up mocks for a single execDump call.
 * Wires up mock query responses for SHOW TABLES, SHOW CREATE TABLE, and SELECT stream.
 */
function setupDumpMocks(options: { connectError?: Error; tables?: string[] } = {}) {
  const tables = options.tables ?? ['test_table'];
  const { conn, queryStream } = createMockConnection({ connectError: options.connectError });
  const gzipStream = createMockGzipStream();
  const fileStream = createMockFileStream();

  mockCreateConnection.mockReturnValue(conn);
  mockCreateGzip.mockReturnValue(gzipStream);
  mockCreateWriteStream.mockReturnValue(fileStream);
  gzipStream.pipe.mockReturnValue(fileStream);

  // Set up query mock to handle both callback and streaming styles
  conn.query.mockImplementation((...args: any[]) => {
    const sql = args[0] as string;
    const cb = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : null;

    if (cb) {
      // Callback-style query (queryPromise)
      if (sql === 'SHOW TABLES') {
        cb(null, tables.map((t) => ({ [`Tables_in_db`]: t })));
      } else if (sql.startsWith('SHOW CREATE TABLE')) {
        const tableName = sql.match(/`(\w+)`/)?.[1] ?? 'test_table';
        cb(null, [{ 'Create Table': `CREATE TABLE \`${tableName}\` (id int)` }]);
      } else {
        cb(null, []);
      }
      return undefined;
    }

    // Streaming-style query (SELECT *)
    process.nextTick(() => {
      queryStream.emit('data', { id: 1, name: 'test' });
      queryStream.emit('end');
    });
    return { stream: () => queryStream };
  });

  return { conn, queryStream, gzipStream, fileStream };
}

describe('BackupService', () => {
  let service: BackupService;
  let mockWebhookService: {
    sendNotification: jest.Mock;
    reloadConfig: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFsPromises.mkdir.mockResolvedValue(undefined);
    mockFsPromises.unlink.mockResolvedValue(undefined);
    mockFsPromises.readdir.mockResolvedValue([]);
    mockFsPromises.writeFile.mockResolvedValue(undefined);

    const configService = createMockConfigService({
      'backup.dir': '/tmp/test-backups',
      DB_HOST: 'localhost',
      DB_PORT: '3306',
      DB_ROOT_PASSWORD: 'testpass',
      'backup.retentionDays': 30,
    });
    mockWebhookService = {
      sendNotification: jest.fn(),
      reloadConfig: jest.fn(),
    };

    service = new BackupService(
      configService as any,
      mockWebhookService as any,
    );
  });

  describe('filename validation (assertSafeFilename via getBackupPath)', () => {
    it('should accept a valid .sql.gz filename', () => {
      expect(() =>
        service.getBackupPath('acore_auth_2024-01-01.sql.gz'),
      ).not.toThrow();
    });

    it('should reject path traversal with ../', () => {
      expect(() => service.getBackupPath('../evil.sql.gz')).toThrow(
        BadRequestException,
      );
    });

    it('should reject forward slash in filename', () => {
      expect(() => service.getBackupPath('path/file.sql.gz')).toThrow(
        BadRequestException,
      );
    });

    it('should reject backslash in filename', () => {
      expect(() => service.getBackupPath('path\\file.sql.gz')).toThrow(
        BadRequestException,
      );
    });

    it('should reject wrong extension', () => {
      expect(() => service.getBackupPath('backup.tar.gz')).toThrow(
        BadRequestException,
      );
    });

    it('should reject empty filename', () => {
      expect(() => service.getBackupPath('')).toThrow(BadRequestException);
    });
  });

  describe('triggerBackup', () => {
    it('should execute dump via mysql2 and return success', async () => {
      const { conn } = setupDumpMocks();
      mockFsPromises.stat.mockResolvedValue({ size: 5000 });
      mockFsPromises.readdir.mockResolvedValue([]);

      const results = await service.triggerBackup(['acore_auth']);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].database).toBe('acore_auth');
      expect(results[0].size).toBe(5000);
      expect(mockCreateConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
          database: 'acore_auth',
        }),
      );
      expect(conn.query).toHaveBeenCalledWith(
        'SHOW TABLES',
        expect.any(Function),
      );
    });

    it('should throw BadRequestException for invalid database name', async () => {
      await expect(service.triggerBackup(['evil_db'])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should report failure and clean up when file is too small', async () => {
      setupDumpMocks();
      mockFsPromises.stat.mockResolvedValue({ size: 50 });
      mockFsPromises.readdir.mockResolvedValue([]);

      const results = await service.triggerBackup(['acore_auth']);

      expect(results[0].success).toBe(false);
      expect(mockFsPromises.unlink).toHaveBeenCalled();
    });

    it('should report failure and clean up when connection fails', async () => {
      setupDumpMocks({ connectError: new Error('Connection refused') });
      mockFsPromises.readdir.mockResolvedValue([]);

      const results = await service.triggerBackup(['acore_auth']);

      expect(results[0].success).toBe(false);
      expect(mockFsPromises.unlink).toHaveBeenCalled();
    });

    it('should send webhook on success', async () => {
      setupDumpMocks();
      mockFsPromises.stat.mockResolvedValue({ size: 5000 });
      mockFsPromises.readdir.mockResolvedValue([]);

      await service.triggerBackup(['acore_auth']);

      expect(mockWebhookService.sendNotification).toHaveBeenCalledWith(
        'backup_success',
        'info',
        expect.any(String),
        expect.any(String),
      );
    });

    it('should send webhook on failure', async () => {
      setupDumpMocks({ connectError: new Error('fail') });
      mockFsPromises.readdir.mockResolvedValue([]);

      await service.triggerBackup(['acore_auth']);

      expect(mockWebhookService.sendNotification).toHaveBeenCalledWith(
        'backup_failed',
        'high',
        expect.any(String),
        expect.any(String),
      );
    });

    it('should report failure when query errors during dump', async () => {
      const { conn } = createMockConnection();
      const gzipStream = createMockGzipStream();
      const fileStream = createMockFileStream();

      mockCreateConnection.mockReturnValue(conn);
      mockCreateGzip.mockReturnValue(gzipStream);
      mockCreateWriteStream.mockReturnValue(fileStream);
      gzipStream.pipe.mockReturnValue(fileStream);
      mockFsPromises.readdir.mockResolvedValue([]);

      conn.query.mockImplementation((...args: any[]) => {
        const cb = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : null;
        if (cb) {
          cb(new Error('Query failed'));
          return undefined;
        }
        return { stream: () => Object.assign(new EventEmitter(), { pause: jest.fn(), resume: jest.fn() }) };
      });

      const results = await service.triggerBackup(['acore_auth']);

      expect(results[0].success).toBe(false);
    });
  });

  describe('matchesCron (via private access)', () => {
    const matchesCron = (date: Date, cron: string) =>
      (service as any).matchesCron(date, cron);

    it('should match * * * * * for any date', () => {
      expect(matchesCron(new Date('2024-06-15T14:30:00'), '* * * * *')).toBe(
        true,
      );
    });

    it('should match 0 3 * * * at 03:00', () => {
      expect(matchesCron(new Date('2024-06-15T03:00:00'), '0 3 * * *')).toBe(
        true,
      );
    });

    it('should not match 0 3 * * * at 03:01', () => {
      expect(matchesCron(new Date('2024-06-15T03:01:00'), '0 3 * * *')).toBe(
        false,
      );
    });

    it('should match */5 step values at minute 0, 5, 10', () => {
      expect(matchesCron(new Date('2024-06-15T00:00:00'), '*/5 * * * *')).toBe(
        true,
      );
      expect(matchesCron(new Date('2024-06-15T00:05:00'), '*/5 * * * *')).toBe(
        true,
      );
      expect(matchesCron(new Date('2024-06-15T00:10:00'), '*/5 * * * *')).toBe(
        true,
      );
    });

    it('should not match */5 step values at minute 3', () => {
      expect(matchesCron(new Date('2024-06-15T00:03:00'), '*/5 * * * *')).toBe(
        false,
      );
    });

    it('should match comma-separated lists 1,15,30', () => {
      expect(
        matchesCron(new Date('2024-06-15T00:01:00'), '1,15,30 * * * *'),
      ).toBe(true);
      expect(
        matchesCron(new Date('2024-06-15T00:15:00'), '1,15,30 * * * *'),
      ).toBe(true);
      expect(
        matchesCron(new Date('2024-06-15T00:30:00'), '1,15,30 * * * *'),
      ).toBe(true);
    });

    it('should match range 1-5 for values within range', () => {
      expect(matchesCron(new Date('2024-06-15T01:00:00'), '0 1-5 * * *')).toBe(
        true,
      );
      expect(matchesCron(new Date('2024-06-15T05:00:00'), '0 1-5 * * *')).toBe(
        true,
      );
    });

    it('should not match range 1-5 at boundary 6', () => {
      expect(matchesCron(new Date('2024-06-15T06:00:00'), '0 1-5 * * *')).toBe(
        false,
      );
    });

    it('should return false for less than 5 fields', () => {
      expect(matchesCron(new Date(), '* * * *')).toBe(false);
    });
  });

  describe('schedule persistence', () => {
    it('should write schedule to file via setSchedule', async () => {
      const config: BackupScheduleConfig = {
        enabled: true,
        cron: '0 4 * * *',
        databases: ['acore_auth'],
        retentionDays: 7,
      };

      await service.setSchedule(config);

      expect(mockFsPromises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('schedule.json'),
        expect.stringContaining('"enabled": true'),
      );
    });

    it('should load saved config via loadScheduleConfig', async () => {
      const savedConfig: BackupScheduleConfig = {
        enabled: true,
        cron: '0 5 * * *',
        databases: ['acore_world'],
        retentionDays: 14,
      };
      mockFsPromises.readFile.mockResolvedValue(JSON.stringify(savedConfig));

      await service.onModuleInit();

      const schedule = await service.getSchedule();
      expect(schedule.enabled).toBe(true);
      expect(schedule.cron).toBe('0 5 * * *');
    });

    it('should use defaults when schedule file is missing', async () => {
      mockFsPromises.readFile.mockRejectedValue(new Error('ENOENT'));

      await service.onModuleInit();

      const schedule = await service.getSchedule();
      expect(schedule.enabled).toBe(false);
      expect(schedule.cron).toBe('0 3 * * *');
    });
  });
});
