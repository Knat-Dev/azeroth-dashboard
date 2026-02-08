import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../../entities/auth/account.entity.js';
import { AccountAccess } from '../../entities/auth/account-access.entity.js';
import { AccountBanned } from '../../entities/auth/account-banned.entity.js';
import { IpBanned } from '../../entities/auth/ip-banned.entity.js';
import { Character } from '../../entities/characters/character.entity.js';
import { makeRegistrationData } from '../auth/srp6.util.js';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Account, 'auth')
    private accountRepo: Repository<Account>,
    @InjectRepository(AccountAccess, 'auth')
    private accountAccessRepo: Repository<AccountAccess>,
    @InjectRepository(AccountBanned, 'auth')
    private accountBannedRepo: Repository<AccountBanned>,
    @InjectRepository(IpBanned, 'auth')
    private ipBannedRepo: Repository<IpBanned>,
    @InjectRepository(Character, 'characters')
    private characterRepo: Repository<Character>,
  ) {}

  async createAccount(
    username: string,
    password: string,
    email?: string,
    expansion = 2,
    gmLevel = 0,
  ) {
    const upperUsername = username.toUpperCase();

    const existing = await this.accountRepo
      .createQueryBuilder('a')
      .where('UPPER(a.username) = :username', { username: upperUsername })
      .getOne();
    if (existing) throw new ConflictException('Username already exists');

    const { salt, verifier } = makeRegistrationData(username, password);

    const account = this.accountRepo.create({
      username: upperUsername,
      salt,
      verifier,
      email: (email ?? '').toUpperCase(),
      regMail: (email ?? '').toUpperCase(),
      expansion,
      joindate: new Date(),
      lastIp: '127.0.0.1',
      locked: 0,
      online: 0,
      locale: 0,
      failed_logins: 0,
      totaltime: 0,
    });
    const saved = await this.accountRepo.save(account);

    if (gmLevel > 0) {
      const access = this.accountAccessRepo.create({
        id: saved.id,
        gmlevel: gmLevel,
        realmId: -1,
        comment: 'Created via dashboard',
      });
      await this.accountAccessRepo.save(access);
    }

    return { id: saved.id, username: saved.username };
  }

  async listAccounts(page = 1, limit = 20, search?: string) {
    const qb = this.accountRepo.createQueryBuilder('a');

    if (search) {
      qb.where('UPPER(a.username) LIKE :search OR a.email LIKE :search', {
        search: `%${search.toUpperCase()}%`,
      });
    }

    qb.orderBy('a.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [accounts, total] = await qb.getManyAndCount();

    const accountIds = accounts.map((a) => a.id);
    const accessRecords =
      accountIds.length > 0
        ? await this.accountAccessRepo
            .createQueryBuilder('aa')
            .where('aa.id IN (:...ids)', { ids: accountIds })
            .getMany()
        : [];

    const accessMap = new Map(accessRecords.map((a) => [a.id, a.gmlevel]));

    return {
      data: accounts.map((a) => ({
        id: a.id,
        username: a.username,
        email: a.email,
        joindate: a.joindate,
        lastIp: a.lastIp,
        lastLogin: a.lastLogin,
        online: a.online,
        expansion: a.expansion,
        gmLevel: accessMap.get(a.id) ?? 0,
      })),
      total,
      page,
      limit,
    };
  }

  async updateAccount(accountId: number, data: Partial<{ expansion: number }>) {
    const account = await this.accountRepo.findOneBy({ id: accountId });
    if (!account) throw new NotFoundException('Account not found');
    await this.accountRepo.update(accountId, data);
    return { message: 'Account updated' };
  }

  async banAccount(
    accountId: number,
    bannedBy: string,
    reason: string,
    duration: number,
  ) {
    const account = await this.accountRepo.findOneBy({ id: accountId });
    if (!account) throw new NotFoundException('Account not found');

    const now = Math.floor(Date.now() / 1000);
    const unbandate = duration > 0 ? now + duration : 0;

    const ban = this.accountBannedRepo.create({
      id: accountId,
      bandate: now,
      unbandate,
      bannedby: bannedBy,
      banreason: reason,
      active: 1,
    });

    await this.accountBannedRepo.save(ban);
    return { message: 'Account banned' };
  }

  async unbanAccount(accountId: number) {
    await this.accountBannedRepo.update(
      { id: accountId, active: 1 },
      { active: 0 },
    );
    return { message: 'Account unbanned' };
  }

  async getStats() {
    const totalAccounts = await this.accountRepo.count();

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentAccounts = await this.accountRepo
      .createQueryBuilder('a')
      .where('a.joindate > :since', { since: oneDayAgo })
      .getCount();

    const activeBans = await this.accountBannedRepo.count({
      where: { active: 1 },
    });

    // Check if worldserver is reachable by querying online characters
    let serverOnline = false;
    let onlinePlayers = 0;
    try {
      onlinePlayers = await this.characterRepo.count({
        where: { online: 1 },
      });
      serverOnline = true;
    } catch {
      // characters DB not reachable means server is likely offline
    }

    return {
      serverOnline,
      onlinePlayers,
      totalAccounts,
      recentAccounts,
      activeBans,
    };
  }

  async listBans(page = 1, limit = 20, search?: string) {
    // We need to join with account table for username search/display
    const qb = this.accountBannedRepo
      .createQueryBuilder('b')
      .innerJoin(Account, 'a', 'a.id = b.id')
      .addSelect('a.username', 'username')
      .where('b.active = 1');

    if (search) {
      qb.andWhere(
        '(UPPER(a.username) LIKE :search OR b.banreason LIKE :search)',
        { search: `%${search.toUpperCase()}%` },
      );
    }

    const total = await qb.getCount();

    const raw = await qb
      .orderBy('b.bandate', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawAndEntities();

    const data = raw.entities.map((b, i) => ({
      id: b.id,
      accountId: b.id,
      username: raw.raw[i]?.username ?? 'Unknown',
      reason: b.banreason,
      bannedBy: b.bannedby,
      banDate: new Date(b.bandate * 1000).toISOString(),
      unbanDate: new Date(b.unbandate * 1000).toISOString(),
    }));

    return { data, total, page, limit };
  }

  // --- IP Bans ---

  async listIpBans(page = 1, limit = 20) {
    const now = Math.floor(Date.now() / 1000);
    const qb = this.ipBannedRepo
      .createQueryBuilder('ib')
      .where('ib.unbandate = 0 OR ib.unbandate > :now', { now });

    const total = await qb.getCount();
    const data = await qb
      .orderBy('ib.bandate', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getMany();

    return {
      data: data.map((b) => ({
        ip: b.ip,
        reason: b.banreason,
        bannedBy: b.bannedby,
        banDate: new Date(b.bandate * 1000).toISOString(),
        unbanDate:
          b.unbandate === 0 ? null : new Date(b.unbandate * 1000).toISOString(),
      })),
      total,
      page,
      limit,
    };
  }

  async createIpBan(
    ip: string,
    bannedBy: string,
    reason: string,
    duration: number,
  ) {
    const now = Math.floor(Date.now() / 1000);
    const unbandate = duration > 0 ? now + duration : 0;

    const ban = this.ipBannedRepo.create({
      ip,
      bandate: now,
      unbandate,
      bannedby: bannedBy,
      banreason: reason,
    });

    await this.ipBannedRepo.save(ban);
    return { message: 'IP banned' };
  }

  async removeIpBan(ip: string) {
    await this.ipBannedRepo.delete({ ip });
    return { message: 'IP unbanned' };
  }

  // --- Password Reset ---

  async resetPassword(accountId: number, newPassword: string) {
    const account = await this.accountRepo.findOneBy({ id: accountId });
    if (!account) throw new NotFoundException('Account not found');

    const { salt, verifier } = makeRegistrationData(
      account.username,
      newPassword,
    );
    await this.accountRepo.update(accountId, { salt, verifier });
    return { message: 'Password reset successfully' };
  }
}
