import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../../entities/auth/account.entity.js';
import { AccountAccess } from '../../entities/auth/account-access.entity.js';
import { AccountBanned } from '../../entities/auth/account-banned.entity.js';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Account, 'auth')
    private accountRepo: Repository<Account>,
    @InjectRepository(AccountAccess, 'auth')
    private accountAccessRepo: Repository<AccountAccess>,
    @InjectRepository(AccountBanned, 'auth')
    private accountBannedRepo: Repository<AccountBanned>,
  ) {}

  async listAccounts(page = 1, limit = 20) {
    const [accounts, total] = await this.accountRepo.findAndCount({
      order: { id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const accountIds = accounts.map((a) => a.id);
    const accessRecords =
      accountIds.length > 0
        ? await this.accountAccessRepo
            .createQueryBuilder('aa')
            .where('aa.id IN (:...ids)', { ids: accountIds })
            .getMany()
        : [];

    const accessMap = new Map(
      accessRecords.map((a) => [a.id, a.gmlevel]),
    );

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

  async listBans() {
    const bans = await this.accountBannedRepo.find({
      where: { active: 1 },
    });

    const accountIds = [...new Set(bans.map((b) => b.id))];
    const accounts =
      accountIds.length > 0
        ? await this.accountRepo
            .createQueryBuilder('a')
            .where('a.id IN (:...ids)', { ids: accountIds })
            .getMany()
        : [];

    const accountMap = new Map(accounts.map((a) => [a.id, a.username]));

    return bans.map((b) => ({
      ...b,
      username: accountMap.get(b.id) ?? 'Unknown',
    }));
  }
}
