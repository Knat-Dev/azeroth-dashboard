import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { CharactersService } from './characters.service';
import {
  createMockRepository,
  createMockQueryBuilder,
  createMockCharacter,
} from '../../shared/test-utils';

describe('CharactersService', () => {
  let service: CharactersService;
  let characterRepo: ReturnType<typeof createMockRepository>;
  let inventoryRepo: ReturnType<typeof createMockRepository>;
  let itemInstanceRepo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    characterRepo = createMockRepository();
    inventoryRepo = createMockRepository();
    itemInstanceRepo = createMockRepository();

    service = new CharactersService(
      characterRepo as any,
      inventoryRepo as any,
      itemInstanceRepo as any,
    );
  });

  describe('getMyCharacters', () => {
    it('should return characters for the given account', async () => {
      const chars = [
        createMockCharacter({ guid: 1, account: 1, name: 'Char1' }),
        createMockCharacter({ guid: 2, account: 1, name: 'Char2' }),
      ];
      characterRepo.find.mockResolvedValue(chars);

      const result = await service.getMyCharacters(1);

      expect(result).toHaveLength(2);
      expect(characterRepo.find).toHaveBeenCalledWith({
        where: { account: 1 },
        order: { level: 'DESC' },
      });
    });
  });

  describe('getCharacterDetail', () => {
    it('should return character for the owner', async () => {
      const char = createMockCharacter({ guid: 1, account: 1 });
      characterRepo.findOne.mockResolvedValue(char);

      const result = await service.getCharacterDetail(1, 1, false);

      expect(result.guid).toBe(1);
    });

    it('should return character for admin even if not owner', async () => {
      const char = createMockCharacter({ guid: 1, account: 2 });
      characterRepo.findOne.mockResolvedValue(char);

      const result = await service.getCharacterDetail(1, 1, true);

      expect(result.guid).toBe(1);
    });

    it('should throw ForbiddenException for non-owner non-admin', async () => {
      const char = createMockCharacter({ guid: 1, account: 2 });
      characterRepo.findOne.mockResolvedValue(char);

      await expect(
        service.getCharacterDetail(1, 1, false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when character not found', async () => {
      characterRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getCharacterDetail(999, 1, false),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCharacterInventory', () => {
    it('should return mapped inventory with items', async () => {
      const char = createMockCharacter({ guid: 1, account: 1 });
      characterRepo.findOne.mockResolvedValue(char);
      inventoryRepo.find.mockResolvedValue([
        { guid: 1, bag: 0, slot: 0, item: 100 },
        { guid: 1, bag: 0, slot: 1, item: 101 },
      ]);

      const qb = createMockQueryBuilder();
      qb.getMany.mockResolvedValue([
        { guid: 100, itemEntry: 1234, ownerGuid: 1, count: 1, enchantments: null, durability: 100 },
        { guid: 101, itemEntry: 5678, ownerGuid: 1, count: 1, enchantments: null, durability: 50 },
      ]);
      itemInstanceRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getCharacterInventory(1, 1, false);

      expect(result).toHaveLength(2);
      expect(result[0].bag).toBe(0);
      expect(result[0].item).toBeDefined();
    });
  });

  describe('searchCharacters', () => {
    it('should search characters by name', async () => {
      const chars = [createMockCharacter({ name: 'TestChar' })];
      characterRepo.find.mockResolvedValue(chars);

      const result = await service.searchCharacters('Test');

      expect(result).toHaveLength(1);
      expect(characterRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });
  });
});
