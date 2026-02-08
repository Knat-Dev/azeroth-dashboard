import { Account } from '../entities/auth/account.entity';
import { AccountAccess } from '../entities/auth/account-access.entity';
import { Character } from '../entities/characters/character.entity';
import { makeRegistrationData } from '../modules/auth/srp6.util';

/** Create a mock TypeORM repository with all common methods. */
export function createMockRepository<T = any>() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    findOneByOrFail: jest.fn(),
    findAndCount: jest.fn(),
    save: jest.fn(),
    create: jest.fn((entity: any) => entity),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(() => createMockQueryBuilder()),
  };
}

/** Create a chained mock query builder. */
export function createMockQueryBuilder() {
  const qb: any = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(null),
    getMany: jest.fn().mockResolvedValue([]),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getCount: jest.fn().mockResolvedValue(0),
    getRawMany: jest.fn().mockResolvedValue([]),
    getRawAndEntities: jest.fn().mockResolvedValue({ entities: [], raw: [] }),
  };
  return qb;
}

/** Create a mock ConfigService.get() with optional overrides. */
export function createMockConfigService(overrides: Record<string, any> = {}) {
  return {
    get: jest.fn((key: string, defaultVal?: any) => {
      if (key in overrides) return overrides[key];
      return defaultVal;
    }),
  };
}

/** Create a mock Account entity with optional overrides. */
export function createMockAccount(overrides: Partial<Account> = {}): Account {
  const { salt, verifier } = makeRegistrationData('TESTUSER', 'TESTPASS');
  return {
    id: 1,
    username: 'TESTUSER',
    salt,
    verifier,
    email: 'TEST@EXAMPLE.COM',
    regMail: 'TEST@EXAMPLE.COM',
    joindate: new Date('2024-01-01'),
    lastIp: '127.0.0.1',
    lastLogin: null,
    online: 0,
    expansion: 2,
    locale: 0,
    failed_logins: 0,
    locked: 0,
    totaltime: 0,
    ...overrides,
  };
}

/** Create a mock AccountAccess entity. */
export function createMockAccountAccess(
  overrides: Partial<AccountAccess> = {},
): AccountAccess {
  return {
    id: 1,
    gmlevel: 3,
    realmId: -1,
    comment: 'Test',
    ...overrides,
  };
}

/** Create a mock Character entity with optional overrides. */
export function createMockCharacter(
  overrides: Partial<Character> = {},
): Character {
  return {
    guid: 1,
    account: 1,
    name: 'TestChar',
    race: 1,
    class: 1,
    gender: 0,
    level: 80,
    money: 0,
    online: 0,
    totaltime: 0,
    zone: 0,
    map: 0,
    health: 100,
    power1: 100,
    power2: 0,
    power3: 0,
    equipmentCache: null,
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    totalKills: 0,
    arenaPoints: 0,
    totalHonorPoints: 0,
    ...overrides,
  };
}
