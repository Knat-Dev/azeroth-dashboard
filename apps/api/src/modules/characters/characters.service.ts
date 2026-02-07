import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Character } from '../../entities/characters/character.entity.js';
import { CharacterInventory } from '../../entities/characters/character-inventory.entity.js';
import { ItemInstance } from '../../entities/characters/item-instance.entity.js';

@Injectable()
export class CharactersService {
  constructor(
    @InjectRepository(Character, 'characters')
    private characterRepo: Repository<Character>,
    @InjectRepository(CharacterInventory, 'characters')
    private inventoryRepo: Repository<CharacterInventory>,
    @InjectRepository(ItemInstance, 'characters')
    private itemInstanceRepo: Repository<ItemInstance>,
  ) {}

  async getMyCharacters(accountId: number) {
    return this.characterRepo.find({
      where: { account: accountId },
      order: { level: 'DESC' },
    });
  }

  async getCharacterDetail(guid: number, accountId: number, isAdmin: boolean) {
    const character = await this.characterRepo.findOne({ where: { guid } });
    if (!character) {
      throw new NotFoundException('Character not found');
    }

    if (character.account !== accountId && !isAdmin) {
      throw new ForbiddenException('Not your character');
    }

    return character;
  }

  async getCharacterInventory(guid: number, accountId: number, isAdmin: boolean) {
    const character = await this.characterRepo.findOne({ where: { guid } });
    if (!character) throw new NotFoundException('Character not found');
    if (character.account !== accountId && !isAdmin) {
      throw new ForbiddenException('Not your character');
    }

    const inventory = await this.inventoryRepo.find({ where: { guid } });

    const itemGuids = inventory.map((i) => i.item);
    if (itemGuids.length === 0) return [];

    const items = await this.itemInstanceRepo
      .createQueryBuilder('item')
      .where('item.guid IN (:...guids)', { guids: itemGuids })
      .getMany();

    const itemMap = new Map(items.map((i) => [i.guid, i]));

    return inventory.map((inv) => ({
      bag: inv.bag,
      slot: inv.slot,
      item: itemMap.get(inv.item) ?? null,
    }));
  }

  async searchCharacters(name: string) {
    return this.characterRepo.find({
      where: { name: Like(`%${name}%`) },
      take: 50,
      order: { level: 'DESC' },
    });
  }
}
