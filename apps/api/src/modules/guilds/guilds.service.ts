import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Guild } from '../../entities/characters/guild.entity.js';
import { GuildMember } from '../../entities/characters/guild-member.entity.js';
import { Character } from '../../entities/characters/character.entity.js';

@Injectable()
export class GuildsService {
  constructor(
    @InjectRepository(Guild, 'characters')
    private guildRepo: Repository<Guild>,
    @InjectRepository(GuildMember, 'characters')
    private guildMemberRepo: Repository<GuildMember>,
    @InjectRepository(Character, 'characters')
    private characterRepo: Repository<Character>,
  ) {}

  async listGuilds(page = 1, limit = 20) {
    const [guilds, total] = await this.guildRepo.findAndCount({
      order: { name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const guildIds = guilds.map((g) => g.guildid);
    const memberCounts =
      guildIds.length > 0
        ? await this.guildMemberRepo
            .createQueryBuilder('gm')
            .select('gm.guildid', 'guildid')
            .addSelect('COUNT(*)', 'count')
            .where('gm.guildid IN (:...ids)', { ids: guildIds })
            .groupBy('gm.guildid')
            .getRawMany()
        : [];

    const countMap = new Map(
      memberCounts.map((mc: { guildid: number; count: string }) => [
        mc.guildid,
        parseInt(mc.count, 10),
      ]),
    );

    return {
      data: guilds.map((g) => ({
        ...g,
        memberCount: countMap.get(g.guildid) ?? 0,
      })),
      total,
      page,
      limit,
    };
  }

  async getGuildDetail(guildId: number) {
    const guild = await this.guildRepo.findOne({
      where: { guildid: guildId },
    });
    if (!guild) throw new NotFoundException('Guild not found');

    const members = await this.guildMemberRepo.find({
      where: { guildid: guildId },
    });

    const charGuids = members.map((m) => m.guid);
    const characters =
      charGuids.length > 0
        ? await this.characterRepo
            .createQueryBuilder('c')
            .where('c.guid IN (:...guids)', { guids: charGuids })
            .getMany()
        : [];

    const charMap = new Map(characters.map((c) => [c.guid, c]));

    return {
      ...guild,
      members: members.map((m) => ({
        ...m,
        character: charMap.get(m.guid) ?? null,
      })),
    };
  }
}
