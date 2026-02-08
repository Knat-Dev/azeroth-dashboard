import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Realmlist } from '../../entities/auth/realmlist.entity.js';
import { Character } from '../../entities/characters/character.entity.js';
import { Guild } from '../../entities/characters/guild.entity.js';
import { GuildMember } from '../../entities/characters/guild-member.entity.js';

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
        'c.guid', 'c.name', 'c.level', 'c.class', 'c.race',
        'c.gender', 'c.zone', 'c.map', 'c.money', 'c.totaltime',
      ])
      .where('c.online = 1');

    if (search) {
      qb.andWhere('LOWER(c.name) LIKE LOWER(:search)', { search: `%${search}%` });
    }

    const [characters, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Fetch guild names for these characters
    const guids = characters.map((c) => c.guid);
    let guildMap = new Map<number, string>();
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
}
