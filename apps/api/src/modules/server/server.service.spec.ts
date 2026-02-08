import { ServerService } from './server.service';
import {
  createMockRepository,
  createMockQueryBuilder,
  createMockCharacter,
} from '../../shared/test-utils';

describe('ServerService', () => {
  let service: ServerService;
  let realmRepo: ReturnType<typeof createMockRepository>;
  let characterRepo: ReturnType<typeof createMockRepository>;
  let guildRepo: ReturnType<typeof createMockRepository>;
  let guildMemberRepo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    realmRepo = createMockRepository();
    characterRepo = createMockRepository();
    guildRepo = createMockRepository();
    guildMemberRepo = createMockRepository();

    service = new ServerService(
      realmRepo as any,
      characterRepo as any,
      guildRepo as any,
      guildMemberRepo as any,
    );
  });

  describe('getStatus', () => {
    it('should return status with realm info', async () => {
      realmRepo.find.mockResolvedValue([
        {
          id: 1,
          name: 'Azeroth',
          address: '127.0.0.1',
          port: 8085,
          population: 0,
        },
      ]);
      characterRepo.count.mockResolvedValue(42);

      const result = await service.getStatus();

      expect(result.online).toBe(true);
      expect(result.playerCount).toBe(42);
      expect(result.realmName).toBe('Azeroth');
      expect(result.realms).toHaveLength(1);
    });

    it('should return offline when no realm found', async () => {
      realmRepo.find.mockResolvedValue([]);
      characterRepo.count.mockResolvedValue(0);

      const result = await service.getStatus();

      expect(result.online).toBe(false);
      expect(result.realmName).toBe('Unknown');
    });
  });

  describe('getRealms', () => {
    it('should return all realms', async () => {
      const realms = [{ id: 1, name: 'Realm1' }];
      realmRepo.find.mockResolvedValue(realms);

      const result = await service.getRealms();

      expect(result).toEqual(realms);
    });
  });

  describe('getOnlinePlayers', () => {
    it('should return paginated online players', async () => {
      const qb = createMockQueryBuilder();
      const players = [
        createMockCharacter({ guid: 1, name: 'Player1', online: 1 }),
      ];
      qb.getManyAndCount.mockResolvedValue([players, 1]);
      characterRepo.createQueryBuilder.mockReturnValue(qb);

      const gmQb = createMockQueryBuilder();
      gmQb.getRawAndEntities.mockResolvedValue({ entities: [], raw: [] });
      guildMemberRepo.createQueryBuilder.mockReturnValue(gmQb);

      const result = await service.getOnlinePlayers(1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(qb.where).toHaveBeenCalledWith('c.online = 1');
    });

    it('should apply search filter', async () => {
      const qb = createMockQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      characterRepo.createQueryBuilder.mockReturnValue(qb);

      await service.getOnlinePlayers(1, 20, 'test');

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('LIKE'),
        expect.objectContaining({ search: '%test%' }),
      );
    });
  });
});
