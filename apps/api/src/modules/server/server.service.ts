import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Realmlist } from '../../entities/auth/realmlist.entity.js';
import { Character } from '../../entities/characters/character.entity.js';

@Injectable()
export class ServerService {
  constructor(
    @InjectRepository(Realmlist, 'auth')
    private realmRepo: Repository<Realmlist>,
    @InjectRepository(Character, 'characters')
    private characterRepo: Repository<Character>,
  ) {}

  async getStatus() {
    const realms = await this.realmRepo.find();
    const onlineCount = await this.characterRepo.count({
      where: { online: 1 },
    });

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

    const onlineCount = await this.characterRepo.count({
      where: { online: 1 },
    });

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
      .select(['c.guid', 'c.name', 'c.level', 'c.class', 'c.race', 'c.gender', 'c.zone', 'c.map'])
      .where('c.online = 1');

    if (search) {
      qb.andWhere('LOWER(c.name) LIKE LOWER(:search)', { search: `%${search}%` });
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }
}
