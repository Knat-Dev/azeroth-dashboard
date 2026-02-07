import Database from 'better-sqlite3';
import { EventService } from './event.service';

// Mock the SQLite config module to use in-memory database
let testDb: Database.Database;

jest.mock('../../config/sqlite.config', () => ({
  getDatabase: () => testDb,
  closeDatabase: jest.fn(),
}));

describe('EventService', () => {
  let service: EventService;

  beforeEach(() => {
    testDb = new Database(':memory:');
    testDb.exec(`
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
    `);
    service = new EventService();
  });

  afterEach(() => {
    testDb.close();
  });

  describe('logEvent', () => {
    it('should insert an event', () => {
      service.logEvent('ac-worldserver', 'crash', 'Server crashed');
      const events = service.getEvents(10);
      expect(events).toHaveLength(1);
      expect(events[0].container).toBe('ac-worldserver');
      expect(events[0].event_type).toBe('crash');
      expect(events[0].details).toBe('Server crashed');
    });

    it('should insert an event with actor', () => {
      service.logEvent('ac-worldserver', 'restart', 'Manual restart', undefined, 'admin');
      const events = service.getEvents(10);
      expect(events[0].actor).toBe('admin');
    });

    it('should handle null optional fields', () => {
      service.logEvent('ac-authserver', 'crash');
      const events = service.getEvents(10);
      expect(events[0].details).toBeNull();
      expect(events[0].duration_ms).toBeNull();
      expect(events[0].actor).toBeNull();
    });
  });

  describe('getEvents', () => {
    beforeEach(() => {
      service.logEvent('ac-worldserver', 'crash', 'crash 1');
      service.logEvent('ac-authserver', 'crash', 'crash 2');
      service.logEvent('ac-worldserver', 'recovery', 'recovered');
    });

    it('should return events in descending order by id', () => {
      const events = service.getEvents(10);
      expect(events).toHaveLength(3);
      expect(events[0].event_type).toBe('recovery');
      expect(events[2].event_type).toBe('crash');
    });

    it('should respect limit', () => {
      const events = service.getEvents(2);
      expect(events).toHaveLength(2);
    });

    it('should filter by container', () => {
      const events = service.getEvents(10, 'ac-worldserver');
      expect(events).toHaveLength(2);
      events.forEach((e) => expect(e.container).toBe('ac-worldserver'));
    });
  });

  describe('getEventsPaginated', () => {
    beforeEach(() => {
      for (let i = 0; i < 5; i++) {
        service.logEvent('ac-worldserver', 'crash', `crash ${i}`);
      }
    });

    it('should return page 1 with correct limit', () => {
      const result = service.getEventsPaginated(1, 2);
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(5);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(2);
    });

    it('should return page 2 with remaining items', () => {
      const result = service.getEventsPaginated(2, 2);
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(5);
    });

    it('should handle total count correctly', () => {
      const result = service.getEventsPaginated(1, 10);
      expect(result.total).toBe(5);
      expect(result.data).toHaveLength(5);
    });

    it('should return empty page when page exceeds total', () => {
      const result = service.getEventsPaginated(10, 2);
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(5);
    });
  });

  describe('countEventsSince', () => {
    it('should count matching events', () => {
      // SQLite datetime('now') returns 'YYYY-MM-DD HH:MM:SS' (no T, no Z)
      // Use the same format for the since parameter
      const past = new Date(Date.now() - 60000).toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
      service.logEvent('ac-worldserver', 'crash', 'c1');
      service.logEvent('ac-worldserver', 'crash', 'c2');
      service.logEvent('ac-worldserver', 'recovery', 'r1');

      const count = service.countEventsSince(past, 'ac-worldserver', 'crash');
      expect(count).toBe(2);
    });

    it('should return zero when no events match', () => {
      const past = new Date(Date.now() - 60000).toISOString();
      const count = service.countEventsSince(past, 'ac-worldserver', 'crash');
      expect(count).toBe(0);
    });
  });

  describe('setSetting / getSetting', () => {
    it('should insert a new setting', () => {
      service.setSetting('webhookUrl', 'https://discord.com/hook');
      expect(service.getSetting('webhookUrl')).toBe('https://discord.com/hook');
    });

    it('should upsert (update) an existing setting', () => {
      service.setSetting('webhookUrl', 'old');
      service.setSetting('webhookUrl', 'new');
      expect(service.getSetting('webhookUrl')).toBe('new');
    });

    it('should return null for missing setting', () => {
      expect(service.getSetting('nonexistent')).toBeNull();
    });
  });

  describe('getAllSettings', () => {
    it('should return all settings as a record', () => {
      service.setSetting('key1', 'val1');
      service.setSetting('key2', 'val2');

      const settings = service.getAllSettings();
      expect(settings).toEqual({ key1: 'val1', key2: 'val2' });
    });
  });

  describe('recordPlayerCount and prunePlayerHistory', () => {
    it('should record player count', () => {
      service.recordPlayerCount(42);
      const rows = testDb
        .prepare('SELECT count FROM player_history')
        .all() as { count: number }[];
      expect(rows).toHaveLength(1);
      expect(rows[0].count).toBe(42);
    });

    it('should prune old records (only records older than 30 days)', () => {
      // Insert a record with an old timestamp
      testDb
        .prepare(
          `INSERT INTO player_history (timestamp, count) VALUES (datetime('now', '-31 days'), 10)`,
        )
        .run();
      // Insert a recent record
      service.recordPlayerCount(20);

      service.prunePlayerHistory();

      const rows = testDb
        .prepare('SELECT count FROM player_history')
        .all() as { count: number }[];
      expect(rows).toHaveLength(1);
      expect(rows[0].count).toBe(20);
    });
  });
});
