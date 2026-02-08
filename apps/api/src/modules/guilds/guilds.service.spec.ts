import { NotFoundException } from '@nestjs/common';
import { GuildsService } from './guilds.service';
import {
  createMockRepository,
  createMockQueryBuilder,
  createMockCharacter,
} from '../../shared/test-utils';

describe('GuildsService', () => {
  let service: GuildsService;
  let guildRepo: ReturnType<typeof createMockRepository>;
  let guildMemberRepo: ReturnType<typeof createMockRepository>;
  let characterRepo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    guildRepo = createMockRepository();
    guildMemberRepo = createMockRepository();
    characterRepo = createMockRepository();

    service = new GuildsService(
      guildRepo as any,
      guildMemberRepo as any,
      characterRepo as any,
    );
  });

  describe('listGuilds', () => {
    it('should return paginated guilds with member counts', async () => {
      guildRepo.findAndCount.mockResolvedValue([
        [{ guildid: 1, name: 'TestGuild', leaderguid: 1 }],
        1,
      ]);

      const qb = createMockQueryBuilder();
      qb.getRawMany.mockResolvedValue([{ guildid: 1, count: '5' }]);
      guildMemberRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.listGuilds(1, 20);

      expect(result.total).toBe(1);
      expect(result.data[0].memberCount).toBe(5);
    });

    it('should handle empty guilds list', async () => {
      guildRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.listGuilds(1, 20);

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getGuildDetail', () => {
    it('should return guild with members and characters', async () => {
      guildRepo.findOne.mockResolvedValue({
        guildid: 1,
        name: 'TestGuild',
        leaderguid: 1,
      });
      guildMemberRepo.find.mockResolvedValue([
        { guildid: 1, guid: 1, rank: 0 },
        { guildid: 1, guid: 2, rank: 1 },
      ]);

      const qb = createMockQueryBuilder();
      qb.getMany.mockResolvedValue([
        createMockCharacter({ guid: 1, name: 'Leader' }),
        createMockCharacter({ guid: 2, name: 'Member' }),
      ]);
      characterRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getGuildDetail(1);

      expect(result.name).toBe('TestGuild');
      expect(result.members).toHaveLength(2);
      expect(result.members[0].character!.name).toBe('Leader');
    });

    it('should throw NotFoundException for non-existent guild', async () => {
      guildRepo.findOne.mockResolvedValue(null);

      await expect(service.getGuildDetail(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle guild with no members', async () => {
      guildRepo.findOne.mockResolvedValue({
        guildid: 1,
        name: 'EmptyGuild',
      });
      guildMemberRepo.find.mockResolvedValue([]);

      const result = await service.getGuildDetail(1);

      expect(result.members).toHaveLength(0);
    });
  });
});
