import { ConflictException, NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import {
  createMockRepository,
  createMockQueryBuilder,
  createMockAccount,
  createMockAccountAccess,
} from '../../shared/test-utils';

describe('AdminService', () => {
  let service: AdminService;
  let accountRepo: ReturnType<typeof createMockRepository>;
  let accountAccessRepo: ReturnType<typeof createMockRepository>;
  let accountBannedRepo: ReturnType<typeof createMockRepository>;
  let ipBannedRepo: ReturnType<typeof createMockRepository>;
  let characterRepo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    accountRepo = createMockRepository();
    accountAccessRepo = createMockRepository();
    accountBannedRepo = createMockRepository();
    ipBannedRepo = createMockRepository();
    characterRepo = createMockRepository();

    service = new AdminService(
      accountRepo as any,
      accountAccessRepo as any,
      accountBannedRepo as any,
      ipBannedRepo as any,
      characterRepo as any,
    );
  });

  describe('createAccount', () => {
    it('should create an account and return id + username', async () => {
      const qb = createMockQueryBuilder();
      qb.getOne.mockResolvedValue(null); // no existing
      accountRepo.createQueryBuilder.mockReturnValue(qb);
      accountRepo.save.mockResolvedValue({ id: 10, username: 'NEWUSER' });

      const result = await service.createAccount(
        'newuser',
        'pass123',
        'test@email.com',
      );

      expect(result).toEqual({ id: 10, username: 'NEWUSER' });
      expect(accountRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'NEWUSER' }),
      );
    });

    it('should throw ConflictException for duplicate username', async () => {
      const qb = createMockQueryBuilder();
      qb.getOne.mockResolvedValue(createMockAccount());
      accountRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(
        service.createAccount('testuser', 'pass123'),
      ).rejects.toThrow(ConflictException);
    });

    it('should create AccountAccess when gmLevel > 0', async () => {
      const qb = createMockQueryBuilder();
      qb.getOne.mockResolvedValue(null);
      accountRepo.createQueryBuilder.mockReturnValue(qb);
      accountRepo.save.mockResolvedValue({ id: 10, username: 'ADMIN' });
      accountAccessRepo.save.mockResolvedValue({});

      await service.createAccount('admin', 'pass', undefined, 2, 3);

      expect(accountAccessRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ id: 10, gmlevel: 3, realmId: -1 }),
      );
      expect(accountAccessRepo.save).toHaveBeenCalled();
    });

    it('should not create AccountAccess when gmLevel is 0', async () => {
      const qb = createMockQueryBuilder();
      qb.getOne.mockResolvedValue(null);
      accountRepo.createQueryBuilder.mockReturnValue(qb);
      accountRepo.save.mockResolvedValue({ id: 10, username: 'PLAYER' });

      await service.createAccount('player', 'pass');

      expect(accountAccessRepo.save).not.toHaveBeenCalled();
    });

    it('should uppercase the username', async () => {
      const qb = createMockQueryBuilder();
      qb.getOne.mockResolvedValue(null);
      accountRepo.createQueryBuilder.mockReturnValue(qb);
      accountRepo.save.mockResolvedValue({ id: 1, username: 'MYUSER' });

      await service.createAccount('myuser', 'pass');

      expect(accountRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'MYUSER' }),
      );
    });
  });

  describe('banAccount', () => {
    it('should ban an existing account', async () => {
      accountRepo.findOneBy.mockResolvedValue(createMockAccount());
      accountBannedRepo.save.mockResolvedValue({});

      const result = await service.banAccount(1, 'admin', 'cheating', 3600);

      expect(result).toEqual({ message: 'Account banned' });
      expect(accountBannedRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          bannedby: 'admin',
          banreason: 'cheating',
          active: 1,
        }),
      );
    });

    it('should throw NotFoundException if account not found', async () => {
      accountRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.banAccount(999, 'admin', 'reason', 0),
      ).rejects.toThrow(NotFoundException);
    });

    it('should set unbandate to 0 for permanent ban (duration=0)', async () => {
      accountRepo.findOneBy.mockResolvedValue(createMockAccount());
      accountBannedRepo.save.mockResolvedValue({});

      await service.banAccount(1, 'admin', 'perm ban', 0);

      expect(accountBannedRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ unbandate: 0 }),
      );
    });

    it('should set unbandate for timed ban (duration > 0)', async () => {
      accountRepo.findOneBy.mockResolvedValue(createMockAccount());
      accountBannedRepo.save.mockResolvedValue({});

      await service.banAccount(1, 'admin', 'temp ban', 3600);

      const createArg = accountBannedRepo.create.mock.calls[0][0];
      expect(createArg.unbandate).toBeGreaterThan(createArg.bandate);
    });
  });

  describe('unbanAccount', () => {
    it('should update active to 0', async () => {
      accountBannedRepo.update.mockResolvedValue({});

      const result = await service.unbanAccount(1);

      expect(result).toEqual({ message: 'Account unbanned' });
      expect(accountBannedRepo.update).toHaveBeenCalledWith(
        { id: 1, active: 1 },
        { active: 0 },
      );
    });
  });

  describe('listAccounts', () => {
    it('should return paginated accounts with gm levels', async () => {
      const accounts = [
        createMockAccount({ id: 1, username: 'USER1' }),
        createMockAccount({ id: 2, username: 'USER2' }),
      ];
      const qb = createMockQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([accounts, 2]);
      accountRepo.createQueryBuilder.mockReturnValue(qb);

      const accessQb = createMockQueryBuilder();
      accessQb.getMany.mockResolvedValue([
        createMockAccountAccess({ id: 1, gmlevel: 3 }),
      ]);
      accountAccessRepo.createQueryBuilder.mockReturnValue(accessQb);

      const result = await service.listAccounts(1, 20);

      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].gmLevel).toBe(3);
      expect(result.data[1].gmLevel).toBe(0); // no access record
    });

    it('should apply search filter', async () => {
      const qb = createMockQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      accountRepo.createQueryBuilder.mockReturnValue(qb);

      await service.listAccounts(1, 20, 'admin');

      expect(qb.where).toHaveBeenCalledWith(
        expect.stringContaining('LIKE'),
        expect.objectContaining({ search: '%ADMIN%' }),
      );
    });
  });

  describe('updateAccount', () => {
    it('should throw NotFoundException if account not found', async () => {
      accountRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.updateAccount(999, { expansion: 2 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStats', () => {
    it('should return stats shape with all fields', async () => {
      accountRepo.count.mockResolvedValue(100);
      const statsQb = createMockQueryBuilder();
      statsQb.getCount.mockResolvedValue(5);
      accountRepo.createQueryBuilder.mockReturnValue(statsQb);
      accountBannedRepo.count.mockResolvedValue(3);
      characterRepo.count.mockResolvedValue(10);

      const result = await service.getStats();

      expect(result).toHaveProperty('serverOnline');
      expect(result).toHaveProperty('onlinePlayers');
      expect(result).toHaveProperty('totalAccounts', 100);
      expect(result).toHaveProperty('recentAccounts', 5);
      expect(result).toHaveProperty('activeBans', 3);
    });

    it('should handle DB failure gracefully (serverOnline = false)', async () => {
      accountRepo.count.mockResolvedValue(100);
      const statsQb = createMockQueryBuilder();
      statsQb.getCount.mockResolvedValue(0);
      accountRepo.createQueryBuilder.mockReturnValue(statsQb);
      accountBannedRepo.count.mockResolvedValue(0);
      characterRepo.count.mockRejectedValue(new Error('DB down'));

      const result = await service.getStats();

      expect(result.serverOnline).toBe(false);
      expect(result.onlinePlayers).toBe(0);
    });
  });

  describe('listBans', () => {
    it('should return paginated bans with join query', async () => {
      const qb = createMockQueryBuilder();
      qb.getCount.mockResolvedValue(1);
      qb.getRawAndEntities.mockResolvedValue({
        entities: [
          {
            id: 1,
            bandate: Math.floor(Date.now() / 1000),
            unbandate: Math.floor(Date.now() / 1000) + 3600,
            bannedby: 'admin',
            banreason: 'test',
            active: 1,
          },
        ],
        raw: [{ username: 'TESTUSER' }],
      });
      accountBannedRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.listBans();

      expect(result.data).toHaveLength(1);
      expect(result.data[0].username).toBe('TESTUSER');
      expect(qb.innerJoin).toHaveBeenCalled();
    });
  });
});
