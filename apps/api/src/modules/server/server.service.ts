import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { ItemTooltipData } from '@repo/shared';
import { Realmlist } from '../../entities/auth/realmlist.entity.js';
import { Character } from '../../entities/characters/character.entity.js';
import { Guild } from '../../entities/characters/guild.entity.js';
import { GuildMember } from '../../entities/characters/guild-member.entity.js';
import { ItemTemplate } from '../../entities/world/item-template.entity.js';

@Injectable()
export class ServerService {
  constructor(
    @InjectRepository(Realmlist, 'auth')
    private realmRepo: Repository<Realmlist>,
    @InjectRepository(Character, 'characters')
    private characterRepo: Repository<Character>,
    @InjectRepository(Guild, 'characters')
    private guildRepo: Repository<Guild>,
    @InjectRepository(GuildMember, 'characters')
    private guildMemberRepo: Repository<GuildMember>,
    @InjectRepository(ItemTemplate, 'world')
    private itemTemplateRepo: Repository<ItemTemplate>,
  ) {}

  async getOnlineCount(): Promise<number> {
    try {
      return await this.characterRepo.count({
        where: { online: 1 },
      });
    } catch {
      return 0;
    }
  }

  async getRealmName(): Promise<string> {
    try {
      const realm = await this.realmRepo.findOne({ where: {} });
      return realm?.name ?? 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  async getStatus() {
    const realms = await this.realmRepo.find();
    const onlineCount = await this.getOnlineCount();

    const realm = realms[0];
    return {
      online: !!realm,
      playerCount: onlineCount,
      realmName: realm?.name ?? 'Unknown',
      realms: realms.map((r) => ({
        id: r.id,
        name: r.name,
        address: r.address,
        port: r.port,
        population: r.population,
      })),
    };
  }

  async getStats() {
    const [totalAccounts] = await this.realmRepo.manager
      .getRepository('Account')
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .getRawMany();

    const onlineCount = await this.getOnlineCount();
    const totalCharacters = await this.characterRepo.count();

    return {
      totalAccounts: parseInt(totalAccounts?.count ?? '0', 10),
      onlinePlayers: onlineCount,
      totalCharacters,
    };
  }

  async getRealms() {
    return this.realmRepo.find();
  }

  async getOnlinePlayers(page = 1, limit = 20, search?: string) {
    const qb = this.characterRepo
      .createQueryBuilder('c')
      .select([
        'c.guid',
        'c.name',
        'c.level',
        'c.class',
        'c.race',
        'c.gender',
        'c.zone',
        'c.map',
        'c.money',
        'c.totaltime',
      ])
      .where('c.online = 1');

    if (search) {
      qb.andWhere('LOWER(c.name) LIKE LOWER(:search)', {
        search: `%${search}%`,
      });
    }

    const [characters, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Fetch guild names for these characters
    const guids = characters.map((c) => c.guid);
    const guildMap = new Map<number, string>();
    if (guids.length > 0) {
      const guildMembers = await this.guildMemberRepo
        .createQueryBuilder('gm')
        .innerJoin(Guild, 'g', 'g.guildid = gm.guildid')
        .addSelect('g.name', 'guildName')
        .where('gm.guid IN (:...guids)', { guids })
        .getRawAndEntities();

      for (let i = 0; i < guildMembers.entities.length; i++) {
        const entity = guildMembers.entities[i];
        const raw = guildMembers.raw[i];
        if (entity && raw) {
          guildMap.set(entity.guid, raw.guildName ?? null);
        }
      }
    }

    const data = characters.map((c) => ({
      guid: c.guid,
      name: c.name,
      level: c.level,
      class: c.class,
      race: c.race,
      gender: c.gender,
      zone: c.zone,
      map: c.map,
      money: c.money,
      totaltime: c.totaltime,
      guildName: guildMap.get(c.guid) ?? null,
    }));

    return { data, total, page, limit };
  }

  async getPlayerDetail(guid: number) {
    const character = await this.characterRepo.findOne({ where: { guid } });
    if (!character) {
      throw new NotFoundException('Character not found');
    }

    // Get guild info
    let guildName: string | null = null;
    let guildRank: number | null = null;
    const guildMember = await this.guildMemberRepo.findOne({
      where: { guid },
    });
    if (guildMember) {
      const guild = await this.guildRepo.findOne({
        where: { guildid: guildMember.guildid },
      });
      guildName = guild?.name ?? null;
      guildRank = guildMember.rank;
    }

    return {
      guid: character.guid,
      name: character.name,
      level: character.level,
      class: character.class,
      race: character.race,
      gender: character.gender,
      zone: character.zone,
      map: character.map,
      money: character.money,
      totaltime: character.totaltime,
      totalKills: character.totalKills,
      arenaPoints: character.arenaPoints,
      totalHonorPoints: character.totalHonorPoints,
      health: character.health,
      power1: character.power1,
      positionX: character.positionX,
      positionY: character.positionY,
      positionZ: character.positionZ,
      account: character.account,
      online: character.online,
      equipmentCache: character.equipmentCache,
      guildName,
      guildRank,
    };
  }

  async getDistribution() {
    const classRows = await this.characterRepo
      .createQueryBuilder('c')
      .select('c.class', 'id')
      .addSelect('COUNT(*)', 'count')
      .groupBy('c.class')
      .getRawMany();

    const raceRows = await this.characterRepo
      .createQueryBuilder('c')
      .select('c.race', 'id')
      .addSelect('COUNT(*)', 'count')
      .groupBy('c.race')
      .getRawMany();

    return {
      classes: classRows.map((r) => ({
        id: parseInt(r.id, 10),
        count: parseInt(r.count, 10),
      })),
      races: raceRows.map((r) => ({
        id: parseInt(r.id, 10),
        count: parseInt(r.count, 10),
      })),
    };
  }

  async getItemTemplates(entries: number[]): Promise<ItemTooltipData[]> {
    // Deduplicate and filter out zeros, cap at 50
    const unique = [...new Set(entries.filter((e) => e > 0))].slice(0, 50);
    if (unique.length === 0) return [];

    const items = await this.itemTemplateRepo.find({
      where: { entry: In(unique) },
    });

    return items.map((item) => {
      const stats: { type: number; value: number }[] = [];
      const rec = item as unknown as Record<string, number>;
      for (let i = 1; i <= 10; i++) {
        const type = rec[`statType${i}`] ?? 0;
        const value = rec[`statValue${i}`] ?? 0;
        if (type !== 0 && value !== 0) {
          stats.push({ type, value });
        }
      }

      return {
        entry: item.entry,
        name: item.name,
        quality: item.quality,
        itemLevel: item.itemLevel,
        itemClass: item.class,
        itemSubclass: item.subclass,
        inventoryType: item.inventoryType,
        bonding: item.bonding,
        requiredLevel: item.requiredLevel,
        armor: item.armor,
        stats,
        dmgMin: item.dmgMin1,
        dmgMax: item.dmgMax1,
        dmgType: item.dmgType1,
        speed: item.delay / 1000,
        maxDurability: item.maxDurability,
        allowableClass: item.allowableClass,
        allowableRace: item.allowableRace,
        sellPrice: item.sellPrice,
        description: item.description,
      };
    });
  }
}
