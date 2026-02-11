import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter } from 'events';
import {
  BackupService,
  BackupScheduleConfig,
  SqlStatementParser,
  isAllowedStatement,
  parseBackupFilename,
} from './backup.service';
import { createMockConfigService } from '../../shared/test-utils';

// Use var so the factory closures can reference them (var is hoisted, const/let are not)
/* eslint-disable no-var */
var mockCreateConnection: jest.Mock;
var mockEscape: jest.Mock;
var mockCreateGzip: jest.Mock;
var mockCreateGunzip: jest.Mock;
var mockFsPromises: Record<string, jest.Mock>;
var mockCreateWriteStream: jest.Mock;
var mockCreateReadStream: jest.Mock;
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
  mockCreateGunzip = jest.fn();
  return { ...actual, createGzip: mockCreateGzip, createGunzip: mockCreateGunzip };
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
    access: jest.fn().mockResolvedValue(undefined),
  };
  mockCreateWriteStream = jest.fn();
  mockCreateReadStream = jest.fn();
  return {
    ...actual,
    promises: mockFsPromises,
    createWriteStream: mockCreateWriteStream,
    createReadStream: mockCreateReadStream,
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

/** Create a mock gunzip transform stream (for restore) */
function createMockGunzipStream() {
  let paused = false;
  const gunzipStream = Object.assign(new EventEmitter(), {
    pipe: jest.fn(),
    destroy: jest.fn(),
    pause: jest.fn(() => { paused = true; }),
    resume: jest.fn(() => { paused = false; }),
    isPaused: jest.fn(() => paused),
  });
  return gunzipStream;
}

/** Create a mock read stream (for restore) */
function createMockReadStreamObj() {
  const readStream = Object.assign(new EventEmitter(), {
    pipe: jest.fn(),
    destroy: jest.fn(),
  });
  return readStream;
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

/**
 * Set up mocks for restore's validateDumpFile or execRestore.
 * Wires readStream → gunzip and emits the given SQL content as data.
 */
function setupRestoreMocks(sqlContent: string) {
  const readStream = createMockReadStreamObj();
  const gunzipStream = createMockGunzipStream();

  mockCreateReadStream.mockReturnValue(readStream);
  mockCreateGunzip.mockReturnValue(gunzipStream);
  mockFsPromises.access.mockResolvedValue(undefined);

  // When readStream.pipe is called, wire up the gunzip to emit the SQL content
  readStream.pipe.mockImplementation(() => {
    process.nextTick(() => {
      gunzipStream.emit('data', Buffer.from(sqlContent));
      gunzipStream.emit('end');
    });
    return gunzipStream;
  });

  return { readStream, gunzipStream };
}

describe('parseBackupFilename', () => {
  it('should parse a normal backup filename', () => {
    const result = parseBackupFilename('acore_auth_2025-02-08T15-30-45-000Z.sql.gz');
    expect(result).toEqual({
      database: 'acore_auth',
      timestamp: '2025-02-08T15-30-45-000Z',
      isPreRestore: false,
    });
  });

  it('should parse a pre-restore backup filename', () => {
    const result = parseBackupFilename('acore_characters_pre-restore_2025-02-08T15-30-45-000Z.sql.gz');
    expect(result).toEqual({
      database: 'acore_characters',
      timestamp: '2025-02-08T15-30-45-000Z',
      isPreRestore: true,
    });
  });

  it('should parse acore_world filename', () => {
    const result = parseBackupFilename('acore_world_2025-02-08T15-30-45-000Z.sql.gz');
    expect(result).toEqual({
      database: 'acore_world',
      timestamp: '2025-02-08T15-30-45-000Z',
      isPreRestore: false,
    });
  });

  it('should parse acore_playerbots filename', () => {
    const result = parseBackupFilename('acore_playerbots_2025-02-08T15-30-45-000Z.sql.gz');
    expect(result).toEqual({
      database: 'acore_playerbots',
      timestamp: '2025-02-08T15-30-45-000Z',
      isPreRestore: false,
    });
  });

  it('should return null for invalid filenames', () => {
    expect(parseBackupFilename('random_file.sql.gz')).toBeNull();
    expect(parseBackupFilename('schedule.json')).toBeNull();
    expect(parseBackupFilename('')).toBeNull();
  });

  it('should return null for non-.sql.gz files', () => {
    expect(parseBackupFilename('acore_auth_2025.tar.gz')).toBeNull();
  });
});

describe('SqlStatementParser', () => {
  it('should split simple statements on semicolons', () => {
    const parser = new SqlStatementParser();
    const stmts = parser.feed('DROP TABLE IF EXISTS `t1`;\nCREATE TABLE `t1` (id int);');
    expect(stmts).toEqual([
      'DROP TABLE IF EXISTS `t1`',
      'CREATE TABLE `t1` (id int)',
    ]);
  });

  it('should handle semicolons inside single-quoted strings', () => {
    const parser = new SqlStatementParser();
    const stmts = parser.feed("INSERT INTO t VALUES ('a;b;c');");
    expect(stmts).toEqual(["INSERT INTO t VALUES ('a;b;c')"]);
  });

  it('should handle escaped quotes inside strings', () => {
    const parser = new SqlStatementParser();
    const stmts = parser.feed("INSERT INTO t VALUES ('it\\'s');");
    expect(stmts).toEqual(["INSERT INTO t VALUES ('it\\'s')"]);
  });

  it('should handle statements split across chunks', () => {
    const parser = new SqlStatementParser();
    const stmts1 = parser.feed('INSERT INTO t VAL');
    expect(stmts1).toEqual([]);
    const stmts2 = parser.feed("UES ('hello');");
    expect(stmts2).toEqual(["INSERT INTO t VALUES ('hello')"]);
  });

  it('should skip comment-only statements', () => {
    const parser = new SqlStatementParser();
    const stmts = parser.feed('-- this is a comment\n-- another comment;\nDROP TABLE IF EXISTS t;');
    expect(stmts).toEqual(['DROP TABLE IF EXISTS t']);
  });

  it('should preserve conditional comments', () => {
    const parser = new SqlStatementParser();
    const stmts = parser.feed('/*!40101 SET NAMES utf8mb4 */;');
    expect(stmts).toEqual(['/*!40101 SET NAMES utf8mb4 */']);
  });

  it('should handle multi-line INSERT', () => {
    const parser = new SqlStatementParser();
    const sql = "INSERT INTO `t` VALUES\n(1,'a'),\n(2,'b');";
    const stmts = parser.feed(sql);
    expect(stmts).toHaveLength(1);
    expect(stmts[0]).toContain("(1,'a')");
    expect(stmts[0]).toContain("(2,'b')");
  });

  it('should return remaining buffer on flush', () => {
    const parser = new SqlStatementParser();
    parser.feed('SELECT 1');
    const remaining = parser.flush();
    expect(remaining).toEqual(['SELECT 1']);
  });

  it('should return empty from flush when buffer is only comments', () => {
    const parser = new SqlStatementParser();
    parser.feed('-- just a comment\n');
    const remaining = parser.flush();
    expect(remaining).toEqual([]);
  });
});

describe('isAllowedStatement', () => {
  it('should allow DROP TABLE IF EXISTS', () => {
    expect(isAllowedStatement('DROP TABLE IF EXISTS `users`')).toBe(true);
  });

  it('should allow CREATE TABLE', () => {
    expect(isAllowedStatement('CREATE TABLE `users` (id int)')).toBe(true);
  });

  it('should allow INSERT INTO', () => {
    expect(isAllowedStatement("INSERT INTO `users` VALUES (1,'test')")).toBe(true);
  });

  it('should allow LOCK TABLES', () => {
    expect(isAllowedStatement('LOCK TABLES `users` WRITE')).toBe(true);
  });

  it('should allow UNLOCK TABLES', () => {
    expect(isAllowedStatement('UNLOCK TABLES')).toBe(true);
  });

  it('should allow conditional comments', () => {
    expect(isAllowedStatement('/*!40101 SET NAMES utf8mb4 */')).toBe(true);
  });

  it('should allow statements with leading comment lines', () => {
    expect(isAllowedStatement('-- Table structure\nDROP TABLE IF EXISTS `t`')).toBe(true);
  });

  it('should reject DROP DATABASE', () => {
    expect(isAllowedStatement('DROP DATABASE acore_auth')).toBe(false);
  });

  it('should reject GRANT', () => {
    expect(isAllowedStatement("GRANT ALL ON *.* TO 'root'")).toBe(false);
  });

  it('should reject CREATE USER', () => {
    expect(isAllowedStatement("CREATE USER 'evil'@'%'")).toBe(false);
  });

  it('should reject raw SET (without conditional wrapper)', () => {
    expect(isAllowedStatement("SET GLOBAL max_connections=1000")).toBe(false);
  });

  it('should reject ALTER TABLE', () => {
    expect(isAllowedStatement('ALTER TABLE users DROP COLUMN id')).toBe(false);
  });

  it('should reject TRUNCATE', () => {
    expect(isAllowedStatement('TRUNCATE TABLE users')).toBe(false);
  });

  it('should reject UPDATE', () => {
    expect(isAllowedStatement("UPDATE users SET name='evil'")).toBe(false);
  });

  it('should reject DELETE', () => {
    expect(isAllowedStatement('DELETE FROM users')).toBe(false);
  });
});

describe('BackupService', () => {
  let service: BackupService;
  let mockWebhookService: {
    sendNotification: jest.Mock;
    reloadConfig: jest.Mock;
  };
  let mockDockerService: {
    stopContainer: jest.Mock;
    startContainer: jest.Mock;
    getContainerState: jest.Mock;
  };
  let mockMonitorService: {
    suppressAutoRestart: jest.Mock;
    resumeAutoRestart: jest.Mock;
    clearCrashLoop: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFsPromises.mkdir.mockResolvedValue(undefined);
    mockFsPromises.unlink.mockResolvedValue(undefined);
    mockFsPromises.readdir.mockResolvedValue([]);
    mockFsPromises.writeFile.mockResolvedValue(undefined);
    mockFsPromises.access.mockResolvedValue(undefined);

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
    mockDockerService = {
      stopContainer: jest.fn().mockResolvedValue({ state: 'exited', status: '', startedAt: null }),
      startContainer: jest.fn().mockResolvedValue({ state: 'running', status: 'Up 1 second', startedAt: new Date().toISOString() }),
      getContainerState: jest.fn().mockResolvedValue({ state: 'exited', status: '', startedAt: null }),
    };
    mockMonitorService = {
      suppressAutoRestart: jest.fn(),
      resumeAutoRestart: jest.fn(),
      clearCrashLoop: jest.fn(),
    };

    service = new BackupService(
      configService as any,
      mockWebhookService as any,
      mockDockerService as any,
      mockMonitorService as any,
    );

    // Mock sleep to avoid real delays in tests
    jest.spyOn(service as any, 'sleep').mockResolvedValue(undefined);
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

  describe('listBackups', () => {
    it('should group files with the same timestamp into one set', async () => {
      const timestamp = '2025-02-08T15-30-45-000Z';
      mockFsPromises.readdir.mockResolvedValue([
        `acore_auth_${timestamp}.sql.gz`,
        `acore_characters_${timestamp}.sql.gz`,
        `acore_playerbots_${timestamp}.sql.gz`,
      ]);
      mockFsPromises.stat.mockResolvedValue({ size: 1000 });

      const sets = await service.listBackups();

      expect(sets).toHaveLength(1);
      expect(sets[0].id).toBe(timestamp);
      expect(sets[0].databases).toEqual(['acore_auth', 'acore_characters', 'acore_playerbots']);
      expect(sets[0].files).toHaveLength(3);
      expect(sets[0].totalSize).toBe(3000);
      expect(sets[0].isPreRestore).toBe(false);
      expect(sets[0].label).toBe('Manual backup');
    });

    it('should group pre-restore files separately', async () => {
      const timestamp = '2025-02-08T15-30-45-000Z';
      mockFsPromises.readdir.mockResolvedValue([
        `acore_auth_${timestamp}.sql.gz`,
        `acore_auth_pre-restore_${timestamp}.sql.gz`,
      ]);
      mockFsPromises.stat.mockResolvedValue({ size: 500 });

      const sets = await service.listBackups();

      expect(sets).toHaveLength(2);
      const normalSet = sets.find((s) => !s.isPreRestore);
      const preRestoreSet = sets.find((s) => s.isPreRestore);
      expect(normalSet).toBeDefined();
      expect(preRestoreSet).toBeDefined();
      expect(preRestoreSet!.label).toBe('Pre-restore backup');
      expect(preRestoreSet!.id).toBe(`pre-restore_${timestamp}`);
    });

    it('should sort sets newest first', async () => {
      mockFsPromises.readdir.mockResolvedValue([
        'acore_auth_2025-01-01T00-00-00-000Z.sql.gz',
        'acore_auth_2025-02-01T00-00-00-000Z.sql.gz',
      ]);
      mockFsPromises.stat.mockResolvedValue({ size: 500 });

      const sets = await service.listBackups();

      expect(sets).toHaveLength(2);
      expect(sets[0].id).toBe('2025-02-01T00-00-00-000Z');
      expect(sets[1].id).toBe('2025-01-01T00-00-00-000Z');
    });

    it('should skip non-.sql.gz files', async () => {
      mockFsPromises.readdir.mockResolvedValue([
        'schedule.json',
        'acore_auth_2025-01-01T00-00-00-000Z.sql.gz',
      ]);
      mockFsPromises.stat.mockResolvedValue({ size: 500 });

      const sets = await service.listBackups();

      expect(sets).toHaveLength(1);
    });

    it('should return empty array on error', async () => {
      mockFsPromises.readdir.mockRejectedValue(new Error('ENOENT'));

      const sets = await service.listBackups();

      expect(sets).toEqual([]);
    });
  });

  describe('getSet', () => {
    it('should return a set by ID', async () => {
      const timestamp = '2025-02-08T15-30-45-000Z';
      mockFsPromises.readdir.mockResolvedValue([
        `acore_auth_${timestamp}.sql.gz`,
      ]);
      mockFsPromises.stat.mockResolvedValue({ size: 1000 });

      const set = await service.getSet(timestamp);

      expect(set.id).toBe(timestamp);
      expect(set.databases).toEqual(['acore_auth']);
    });

    it('should throw NotFoundException for missing set', async () => {
      mockFsPromises.readdir.mockResolvedValue([]);

      await expect(service.getSet('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteSet', () => {
    it('should delete all files in a set', async () => {
      const timestamp = '2025-02-08T15-30-45-000Z';
      mockFsPromises.readdir.mockResolvedValue([
        `acore_auth_${timestamp}.sql.gz`,
        `acore_characters_${timestamp}.sql.gz`,
      ]);
      mockFsPromises.stat.mockResolvedValue({ size: 1000 });

      const result = await service.deleteSet(timestamp);

      expect(result.deleted).toBe(2);
      expect(mockFsPromises.unlink).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundException for missing set', async () => {
      mockFsPromises.readdir.mockResolvedValue([]);

      await expect(service.deleteSet('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateSet', () => {
    it('should validate all files in a set and return valid when all pass', async () => {
      const timestamp = '2025-02-08T15-30-45-000Z';
      mockFsPromises.readdir.mockResolvedValue([
        `acore_auth_${timestamp}.sql.gz`,
      ]);
      mockFsPromises.stat.mockResolvedValue({ size: 1000 });

      const validSql = [
        '-- Pure Node.js dump of acore_auth',
        '-- Generated: 2025-02-08T15:30:45.000Z',
        '',
        '/*!40101 SET NAMES utf8mb4 */;',
        'DROP TABLE IF EXISTS `account`;',
        'CREATE TABLE `account` (id int);',
      ].join('\n');

      setupRestoreMocks(validSql);

      const result = await service.validateSet(timestamp);

      expect(result.valid).toBe(true);
      expect(result.setId).toBe(timestamp);
      expect(result.files).toHaveLength(1);
      expect(result.files[0].valid).toBe(true);
    });

    it('should return invalid when any file fails validation', async () => {
      const timestamp = '2025-02-08T15-30-45-000Z';
      mockFsPromises.readdir.mockResolvedValue([
        `acore_auth_${timestamp}.sql.gz`,
      ]);
      mockFsPromises.stat.mockResolvedValue({ size: 1000 });

      const invalidSql = 'DROP DATABASE acore_auth;\nDROP TABLE IF EXISTS `t`;';
      setupRestoreMocks(invalidSql);

      const result = await service.validateSet(timestamp);

      expect(result.valid).toBe(false);
      expect(result.files[0].valid).toBe(false);
      expect(result.files[0].errors.length).toBeGreaterThan(0);
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
      expect(schedule!.enabled).toBe(true);
      expect(schedule!.cron).toBe('0 5 * * *');
    });

    it('should use defaults when schedule file is missing', async () => {
      mockFsPromises.readFile.mockRejectedValue(new Error('ENOENT'));

      await service.onModuleInit();

      const schedule = await service.getSchedule();
      expect(schedule).toBeNull();
    });
  });

  describe('validateDumpFile', () => {
    it('should validate a valid dump file', async () => {
      const sql = [
        '-- Pure Node.js dump of acore_auth',
        '-- Generated: 2024-01-01T00:00:00.000Z',
        '',
        '/*!40101 SET NAMES utf8mb4 */;',
        'DROP TABLE IF EXISTS `account`;',
        'CREATE TABLE `account` (id int);',
        'LOCK TABLES `account` WRITE;',
        "INSERT INTO `account` VALUES (1,'test');",
        'UNLOCK TABLES;',
      ].join('\n');

      setupRestoreMocks(sql);

      const result = await service.validateDumpFile('acore_auth_2024-01-01.sql.gz');

      expect(result.valid).toBe(true);
      expect(result.database).toBe('acore_auth');
      expect(result.tableCount).toBe(1);
      expect(result.tables).toContain('account');
      expect(result.statementCount).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
      expect(result.generatedAt).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should reject dump containing DROP DATABASE', async () => {
      const sql = 'DROP DATABASE acore_auth;\nDROP TABLE IF EXISTS `t`;';
      setupRestoreMocks(sql);

      const result = await service.validateDumpFile('acore_auth_2024-01-01.sql.gz');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('disallowed');
    });

    it('should reject dump containing GRANT', async () => {
      const sql = "GRANT ALL ON *.* TO 'root'@'%';";
      setupRestoreMocks(sql);

      const result = await service.validateDumpFile('acore_auth_2024-01-01.sql.gz');

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('disallowed');
    });

    it('should throw on file not found', async () => {
      mockFsPromises.access.mockRejectedValue(new Error('ENOENT'));

      await expect(
        service.validateDumpFile('acore_auth_2024-01-01.sql.gz'),
      ).rejects.toThrow();
    });

    it('should throw on unrecognized database prefix', async () => {
      await expect(
        service.validateDumpFile('unknown_db_2024-01-01.sql.gz'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should report error for empty dump', async () => {
      setupRestoreMocks('-- just comments\n');

      const result = await service.validateDumpFile('acore_auth_2024-01-01.sql.gz');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Dump file contains no SQL statements');
    });
  });

  describe('restoreSet', () => {
    /** Helper: flush microtask queue so fire-and-forget executeRestore() completes */
    async function flushRestore() {
      // Give enough ticks for the full async restore chain to settle
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => process.nextTick(r));
      }
    }

    /** Helper to set up mocks for a full set-based restore flow */
    function setupFullRestoreMocks() {
      const timestamp = '2025-02-08T15-30-45-000Z';

      // Set up readdir to return a single-file set
      mockFsPromises.readdir.mockResolvedValue([
        `acore_auth_${timestamp}.sql.gz`,
      ]);
      mockFsPromises.stat.mockResolvedValue({ size: 5000 });

      const validSql = [
        '-- Pure Node.js dump of acore_auth',
        '-- Generated: 2025-02-08T15:30:45.000Z',
        '',
        '/*!40101 SET NAMES utf8mb4 */;',
        'DROP TABLE IF EXISTS `account`;',
        'CREATE TABLE `account` (id int);',
        "INSERT INTO `account` VALUES (1,'test');",
      ].join('\n');

      // Set up for validation pass (first call) and execution pass (second call)
      const readStream1 = createMockReadStreamObj();
      const gunzipStream1 = createMockGunzipStream();
      const readStream2 = createMockReadStreamObj();
      const gunzipStream2 = createMockGunzipStream();

      let readStreamCallCount = 0;
      let gunzipCallCount = 0;

      mockCreateReadStream.mockImplementation(() => {
        readStreamCallCount++;
        return readStreamCallCount === 1 ? readStream1 : readStream2;
      });

      mockCreateGunzip.mockImplementation(() => {
        gunzipCallCount++;
        return gunzipCallCount === 1 ? gunzipStream1 : gunzipStream2;
      });

      // Wire up both passes
      readStream1.pipe.mockImplementation(() => {
        process.nextTick(() => {
          gunzipStream1.emit('data', Buffer.from(validSql));
          gunzipStream1.emit('end');
        });
        return gunzipStream1;
      });

      readStream2.pipe.mockImplementation(() => {
        process.nextTick(() => {
          gunzipStream2.emit('data', Buffer.from(validSql));
          gunzipStream2.emit('end');
        });
        return gunzipStream2;
      });

      // Set up execDump for pre-restore backup
      const dumpConn = createMockConnection();
      const gzipStream = createMockGzipStream();
      const fileStream = createMockFileStream();

      // Set up restore connection
      const restoreConn = createMockConnection();

      // mockCreateConnection returns dump conn first, then restore conn
      let connCallCount = 0;
      mockCreateConnection.mockImplementation(() => {
        connCallCount++;
        return connCallCount === 1 ? dumpConn.conn : restoreConn.conn;
      });

      mockCreateGzip.mockReturnValue(gzipStream);
      mockCreateWriteStream.mockReturnValue(fileStream);
      gzipStream.pipe.mockReturnValue(fileStream);

      // Set up dump conn queries
      dumpConn.conn.query.mockImplementation((...args: any[]) => {
        const sql = args[0] as string;
        const cb = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : null;
        if (cb) {
          if (sql === 'SHOW TABLES') {
            cb(null, [{ Tables_in_db: 'account' }]);
          } else if (sql.startsWith('SHOW CREATE TABLE')) {
            cb(null, [{ 'Create Table': 'CREATE TABLE `account` (id int)' }]);
          } else {
            cb(null, []);
          }
          return undefined;
        }
        const qs = Object.assign(new EventEmitter(), { pause: jest.fn(), resume: jest.fn() });
        process.nextTick(() => {
          qs.emit('data', { id: 1 });
          qs.emit('end');
        });
        return { stream: () => qs };
      });

      // Set up restore conn queries (each query succeeds)
      restoreConn.conn.query.mockImplementation((...args: any[]) => {
        const cb = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : null;
        if (cb) {
          cb(null, []);
          return undefined;
        }
        return undefined;
      });

      return { timestamp, dumpConn, restoreConn, readStream1, readStream2, gunzipStream1, gunzipStream2 };
    }

    it('should return operationId immediately', async () => {
      setupFullRestoreMocks();
      const { timestamp } = setupFullRestoreMocks();

      const result = await service.restoreSet(timestamp);

      expect(result).toHaveProperty('operationId');
      expect(typeof result.operationId).toBe('string');

      await flushRestore();
    });

    it('should complete full restore flow successfully via progress', async () => {
      const { timestamp } = setupFullRestoreMocks();

      const { operationId } = await service.restoreSet(timestamp);
      await flushRestore();

      const progress = service.getRestoreProgress(operationId);
      expect(progress).toBeDefined();
      expect(progress!.status).toBe('completed');
      expect(progress!.result).toBeDefined();
      expect(progress!.result!.success).toBe(true);
      expect(progress!.result!.setId).toBe(timestamp);
      expect(progress!.result!.databases).toEqual(['acore_auth']);
      expect(progress!.result!.preRestoreSetId).toContain('pre-restore_');
      expect(progress!.result!.errors).toHaveLength(0);

      // Verify server lifecycle
      expect(mockMonitorService.suppressAutoRestart).toHaveBeenCalled();
      expect(mockDockerService.stopContainer).toHaveBeenCalledWith('ac-worldserver', 300);
      expect(mockDockerService.stopContainer).toHaveBeenCalledWith('ac-authserver', 300);
      expect(mockDockerService.startContainer).toHaveBeenCalledWith('ac-authserver');
      expect(mockDockerService.startContainer).toHaveBeenCalledWith('ac-worldserver');
      expect(mockMonitorService.resumeAutoRestart).toHaveBeenCalled();
      expect(mockMonitorService.clearCrashLoop).toHaveBeenCalledWith('ac-worldserver');
      expect(mockMonitorService.clearCrashLoop).toHaveBeenCalledWith('ac-authserver');
    });

    it('should track step progress from pending to done', async () => {
      const { timestamp } = setupFullRestoreMocks();

      const { operationId } = await service.restoreSet(timestamp);

      // Initially steps should exist
      const initialProgress = service.getRestoreProgress(operationId);
      expect(initialProgress).toBeDefined();
      expect(initialProgress!.steps.length).toBeGreaterThan(0);

      await flushRestore();

      const finalProgress = service.getRestoreProgress(operationId);
      expect(finalProgress!.status).toBe('completed');
      // All steps should be done
      const doneSteps = finalProgress!.steps.filter(s => s.status === 'done');
      expect(doneSteps.length).toBe(finalProgress!.steps.length);
    });

    it('should abort on validation failure without stopping servers', async () => {
      const timestamp = '2025-02-08T15-30-45-000Z';
      mockFsPromises.readdir.mockResolvedValue([
        `acore_auth_${timestamp}.sql.gz`,
      ]);
      mockFsPromises.stat.mockResolvedValue({ size: 1000 });

      const sql = 'DROP DATABASE acore_auth;';
      setupRestoreMocks(sql);

      await expect(
        service.restoreSet(timestamp),
      ).rejects.toThrow(BadRequestException);

      expect(mockDockerService.stopContainer).not.toHaveBeenCalled();
      expect(mockDockerService.startContainer).not.toHaveBeenCalled();
    });

    it('should restart servers even when pre-backup fails', async () => {
      const timestamp = '2025-02-08T15-30-45-000Z';
      mockFsPromises.readdir.mockResolvedValue([
        `acore_auth_${timestamp}.sql.gz`,
      ]);
      mockFsPromises.stat.mockResolvedValue({ size: 1000 });

      // Set up validation pass
      const validSql = '/*!40101 SET NAMES utf8mb4 */;\nDROP TABLE IF EXISTS `t`;';

      const readStream = createMockReadStreamObj();
      const gunzipStream = createMockGunzipStream();

      mockCreateReadStream.mockReturnValue(readStream);
      mockCreateGunzip.mockReturnValue(gunzipStream);

      readStream.pipe.mockImplementation(() => {
        process.nextTick(() => {
          gunzipStream.emit('data', Buffer.from(validSql));
          gunzipStream.emit('end');
        });
        return gunzipStream;
      });

      // Pre-restore backup fails — connection error
      mockCreateConnection.mockReturnValue(
        createMockConnection({ connectError: new Error('Connection refused') }).conn,
      );
      mockCreateGzip.mockReturnValue(createMockGzipStream());
      mockCreateWriteStream.mockReturnValue(createMockFileStream());

      const { operationId } = await service.restoreSet(timestamp);
      await flushRestore();

      const progress = service.getRestoreProgress(operationId);
      expect(progress!.status).toBe('failed');

      // Servers should always be restarted in finally block
      expect(mockDockerService.startContainer).toHaveBeenCalledWith('ac-authserver');
      expect(mockDockerService.startContainer).toHaveBeenCalledWith('ac-worldserver');
      expect(mockMonitorService.resumeAutoRestart).toHaveBeenCalled();
    });

    it('should send restore_success webhook on success', async () => {
      const { timestamp } = setupFullRestoreMocks();

      await service.restoreSet(timestamp);
      await flushRestore();

      expect(mockWebhookService.sendNotification).toHaveBeenCalledWith(
        'restore_success',
        'info',
        expect.stringContaining('acore_auth'),
        expect.any(String),
      );
    });

    it('should send restore_failed webhook on failure', async () => {
      const timestamp = '2025-02-08T15-30-45-000Z';
      mockFsPromises.readdir.mockResolvedValue([
        `acore_auth_${timestamp}.sql.gz`,
      ]);
      mockFsPromises.stat.mockResolvedValue({ size: 1000 });

      const validSql = '/*!40101 SET NAMES utf8mb4 */;\nDROP TABLE IF EXISTS `t`;';

      const readStream = createMockReadStreamObj();
      const gunzipStream = createMockGunzipStream();

      mockCreateReadStream.mockReturnValue(readStream);
      mockCreateGunzip.mockReturnValue(gunzipStream);

      readStream.pipe.mockImplementation(() => {
        process.nextTick(() => {
          gunzipStream.emit('data', Buffer.from(validSql));
          gunzipStream.emit('end');
        });
        return gunzipStream;
      });

      // Pre-backup fails
      mockCreateConnection.mockReturnValue(
        createMockConnection({ connectError: new Error('fail') }).conn,
      );
      mockCreateGzip.mockReturnValue(createMockGzipStream());
      mockCreateWriteStream.mockReturnValue(createMockFileStream());

      await service.restoreSet(timestamp);
      await flushRestore();

      expect(mockWebhookService.sendNotification).toHaveBeenCalledWith(
        'restore_failed',
        'high',
        expect.stringContaining(timestamp),
        expect.any(String),
      );
    });

    it('should abort restore if servers are still running after stop', async () => {
      const timestamp = '2025-02-08T15-30-45-000Z';
      mockFsPromises.readdir.mockResolvedValue([
        `acore_auth_${timestamp}.sql.gz`,
      ]);
      mockFsPromises.stat.mockResolvedValue({ size: 1000 });

      const validSql = '/*!40101 SET NAMES utf8mb4 */;\nDROP TABLE IF EXISTS `t`;';

      const readStream = createMockReadStreamObj();
      const gunzipStream = createMockGunzipStream();

      mockCreateReadStream.mockReturnValue(readStream);
      mockCreateGunzip.mockReturnValue(gunzipStream);

      readStream.pipe.mockImplementation(() => {
        process.nextTick(() => {
          gunzipStream.emit('data', Buffer.from(validSql));
          gunzipStream.emit('end');
        });
        return gunzipStream;
      });

      // stopContainer succeeds but getContainerState says still running
      mockDockerService.stopContainer.mockResolvedValue({ state: 'exited', status: '', startedAt: null });
      mockDockerService.getContainerState.mockResolvedValue({ state: 'running', status: 'Up', startedAt: null });

      mockCreateConnection.mockReturnValue(createMockConnection().conn);
      mockCreateGzip.mockReturnValue(createMockGzipStream());
      mockCreateWriteStream.mockReturnValue(createMockFileStream());

      const { operationId } = await service.restoreSet(timestamp);
      await flushRestore();

      const progress = service.getRestoreProgress(operationId);
      expect(progress!.status).toBe('failed');
      const verifyStep = progress!.steps.find(s => s.id === 'verify_stopped');
      expect(verifyStep!.status).toBe('failed');
      expect(verifyStep!.error).toContain('still running');
    });

    it('should set step to failed when stopContainer throws', async () => {
      const timestamp = '2025-02-08T15-30-45-000Z';
      mockFsPromises.readdir.mockResolvedValue([
        `acore_auth_${timestamp}.sql.gz`,
      ]);
      mockFsPromises.stat.mockResolvedValue({ size: 1000 });

      const validSql = '/*!40101 SET NAMES utf8mb4 */;\nDROP TABLE IF EXISTS `t`;';

      const readStream = createMockReadStreamObj();
      const gunzipStream = createMockGunzipStream();

      mockCreateReadStream.mockReturnValue(readStream);
      mockCreateGunzip.mockReturnValue(gunzipStream);

      readStream.pipe.mockImplementation(() => {
        process.nextTick(() => {
          gunzipStream.emit('data', Buffer.from(validSql));
          gunzipStream.emit('end');
        });
        return gunzipStream;
      });

      // stopContainer throws (simulating timeout)
      mockDockerService.stopContainer.mockRejectedValue(new Error('Docker API request timed out'));

      const { operationId } = await service.restoreSet(timestamp);
      await flushRestore();

      const progress = service.getRestoreProgress(operationId);
      expect(progress!.status).toBe('failed');
      const wsStep = progress!.steps.find(s => s.id === 'stop_worldserver');
      expect(wsStep!.status).toBe('failed');
    });

    it('should return undefined for unknown operationId', () => {
      expect(service.getRestoreProgress('nonexistent')).toBeUndefined();
    });
  });

  describe('cleanOldBackups', () => {
    it('should delete entire sets past retention', async () => {
      // Set retention to 1 day
      await service.setSchedule({
        enabled: false,
        cron: '0 3 * * *',
        databases: ['acore_auth'],
        retentionDays: 1,
      });

      // Create an old timestamp (2 days ago)
      const oldDate = new Date(Date.now() - 2 * 86400000);
      const oldTimestamp = oldDate.toISOString().replace(/[:.]/g, '-');

      mockFsPromises.readdir.mockResolvedValue([
        `acore_auth_${oldTimestamp}.sql.gz`,
        `acore_characters_${oldTimestamp}.sql.gz`,
      ]);
      mockFsPromises.stat.mockResolvedValue({ size: 1000 });

      // Trigger a backup which calls cleanOldBackups
      setupDumpMocks();
      mockFsPromises.stat.mockResolvedValue({ size: 5000 });

      await service.triggerBackup(['acore_auth']);

      // Both old files should be deleted
      expect(mockFsPromises.unlink).toHaveBeenCalledWith(
        expect.stringContaining(`acore_auth_${oldTimestamp}.sql.gz`),
      );
      expect(mockFsPromises.unlink).toHaveBeenCalledWith(
        expect.stringContaining(`acore_characters_${oldTimestamp}.sql.gz`),
      );
    });
  });

  describe('concurrency lock', () => {
    it('should block simultaneous restores on the same database', async () => {
      (service as any).acquireLock('acore_auth');

      expect(() => (service as any).acquireLock('acore_auth')).toThrow(
        ConflictException,
      );

      (service as any).releaseLock('acore_auth');
    });

    it('should block backup during active restore on the same database', async () => {
      (service as any).acquireLock('acore_auth');

      await expect(service.triggerBackup(['acore_auth'])).rejects.toThrow(
        ConflictException,
      );

      (service as any).releaseLock('acore_auth');
    });

    it('should release lock after validation failure', async () => {
      const timestamp = '2025-02-08T15-30-45-000Z';
      mockFsPromises.readdir.mockResolvedValue([
        `acore_auth_${timestamp}.sql.gz`,
      ]);
      mockFsPromises.stat.mockResolvedValue({ size: 1000 });

      // Validation fails before lock
      const sql = 'DROP DATABASE acore_auth;';
      setupRestoreMocks(sql);

      await expect(
        service.restoreSet(timestamp),
      ).rejects.toThrow();

      // Lock should not be held (validation fails before acquire)
      expect(() => (service as any).acquireLock('acore_auth')).not.toThrow();
      (service as any).releaseLock('acore_auth');
    });

    it('should release lock after failed restore', async () => {
      const timestamp = '2025-02-08T15-30-45-000Z';
      mockFsPromises.readdir.mockResolvedValue([
        `acore_auth_${timestamp}.sql.gz`,
      ]);
      mockFsPromises.stat.mockResolvedValue({ size: 1000 });

      const validSql = '/*!40101 SET NAMES utf8mb4 */;\nDROP TABLE IF EXISTS `t`;';

      const readStream = createMockReadStreamObj();
      const gunzipStream = createMockGunzipStream();

      mockCreateReadStream.mockReturnValue(readStream);
      mockCreateGunzip.mockReturnValue(gunzipStream);

      readStream.pipe.mockImplementation(() => {
        process.nextTick(() => {
          gunzipStream.emit('data', Buffer.from(validSql));
          gunzipStream.emit('end');
        });
        return gunzipStream;
      });

      mockCreateConnection.mockReturnValue(
        createMockConnection({ connectError: new Error('fail') }).conn,
      );
      mockCreateGzip.mockReturnValue(createMockGzipStream());
      mockCreateWriteStream.mockReturnValue(createMockFileStream());

      await service.restoreSet(timestamp);

      // Wait for background restore to finish
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => process.nextTick(r));
      }

      // Lock should be released in finally block
      expect(() => (service as any).acquireLock('acore_auth')).not.toThrow();
      (service as any).releaseLock('acore_auth');
    });
  });

  describe('server lifecycle during restore', () => {
    it('should stop worldserver before authserver', async () => {
      const callOrder: string[] = [];
      mockDockerService.stopContainer.mockImplementation(async (name: string) => {
        callOrder.push(`stop:${name}`);
        return { state: 'exited', status: '', startedAt: null };
      });

      await (service as any).stopServers();

      expect(callOrder).toEqual(['stop:ac-worldserver', 'stop:ac-authserver']);
    });

    it('should start authserver before worldserver', async () => {
      const callOrder: string[] = [];
      mockDockerService.startContainer.mockImplementation(async (name: string) => {
        callOrder.push(`start:${name}`);
        return { state: 'running', status: 'Up', startedAt: new Date().toISOString() };
      });

      await (service as any).startServers();

      const authIdx = callOrder.indexOf('start:ac-authserver');
      const worldIdx = callOrder.indexOf('start:ac-worldserver');
      expect(authIdx).toBeLessThan(worldIdx);
    });

    it('should suppress auto-restart before stopping servers', async () => {
      const timestamp = '2025-02-08T15-30-45-000Z';
      mockFsPromises.readdir.mockResolvedValue([
        `acore_auth_${timestamp}.sql.gz`,
      ]);
      mockFsPromises.stat.mockResolvedValue({ size: 1000 });

      const validSql = '/*!40101 SET NAMES utf8mb4 */;\nDROP TABLE IF EXISTS `t`;';

      const readStream = createMockReadStreamObj();
      const gunzipStream = createMockGunzipStream();

      mockCreateReadStream.mockReturnValue(readStream);
      mockCreateGunzip.mockReturnValue(gunzipStream);

      readStream.pipe.mockImplementation(() => {
        process.nextTick(() => {
          gunzipStream.emit('data', Buffer.from(validSql));
          gunzipStream.emit('end');
        });
        return gunzipStream;
      });

      mockCreateConnection.mockReturnValue(
        createMockConnection({ connectError: new Error('fail') }).conn,
      );
      mockCreateGzip.mockReturnValue(createMockGzipStream());
      mockCreateWriteStream.mockReturnValue(createMockFileStream());

      const callOrder: string[] = [];
      mockMonitorService.suppressAutoRestart.mockImplementation(() => callOrder.push('suppress'));
      mockDockerService.stopContainer.mockImplementation(async () => {
        callOrder.push('stop');
        return { state: 'exited', status: '', startedAt: null };
      });

      await service.restoreSet(timestamp);

      // Wait for background restore to finish
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => process.nextTick(r));
      }

      const suppressIdx = callOrder.indexOf('suppress');
      const firstStopIdx = callOrder.indexOf('stop');
      expect(suppressIdx).toBeLessThan(firstStopIdx);
    });

    it('should resume auto-restart in finally even on failure', async () => {
      const timestamp = '2025-02-08T15-30-45-000Z';
      mockFsPromises.readdir.mockResolvedValue([
        `acore_auth_${timestamp}.sql.gz`,
      ]);
      mockFsPromises.stat.mockResolvedValue({ size: 1000 });

      const validSql = '/*!40101 SET NAMES utf8mb4 */;\nDROP TABLE IF EXISTS `t`;';

      const readStream = createMockReadStreamObj();
      const gunzipStream = createMockGunzipStream();

      mockCreateReadStream.mockReturnValue(readStream);
      mockCreateGunzip.mockReturnValue(gunzipStream);

      readStream.pipe.mockImplementation(() => {
        process.nextTick(() => {
          gunzipStream.emit('data', Buffer.from(validSql));
          gunzipStream.emit('end');
        });
        return gunzipStream;
      });

      mockCreateConnection.mockReturnValue(
        createMockConnection({ connectError: new Error('fail') }).conn,
      );
      mockCreateGzip.mockReturnValue(createMockGzipStream());
      mockCreateWriteStream.mockReturnValue(createMockFileStream());

      await service.restoreSet(timestamp);

      // Wait for background restore to finish
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => process.nextTick(r));
      }

      expect(mockMonitorService.resumeAutoRestart).toHaveBeenCalled();
    });

    it('should call startContainer in finally even on failure', async () => {
      const timestamp = '2025-02-08T15-30-45-000Z';
      mockFsPromises.readdir.mockResolvedValue([
        `acore_auth_${timestamp}.sql.gz`,
      ]);
      mockFsPromises.stat.mockResolvedValue({ size: 1000 });

      const validSql = '/*!40101 SET NAMES utf8mb4 */;\nDROP TABLE IF EXISTS `t`;';

      const readStream = createMockReadStreamObj();
      const gunzipStream = createMockGunzipStream();

      mockCreateReadStream.mockReturnValue(readStream);
      mockCreateGunzip.mockReturnValue(gunzipStream);

      readStream.pipe.mockImplementation(() => {
        process.nextTick(() => {
          gunzipStream.emit('data', Buffer.from(validSql));
          gunzipStream.emit('end');
        });
        return gunzipStream;
      });

      mockCreateConnection.mockReturnValue(
        createMockConnection({ connectError: new Error('fail') }).conn,
      );
      mockCreateGzip.mockReturnValue(createMockGzipStream());
      mockCreateWriteStream.mockReturnValue(createMockFileStream());

      await service.restoreSet(timestamp);

      // Wait for background restore to finish
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => process.nextTick(r));
      }

      expect(mockDockerService.startContainer).toHaveBeenCalledWith('ac-authserver');
      expect(mockDockerService.startContainer).toHaveBeenCalledWith('ac-worldserver');
    });
  });
});
