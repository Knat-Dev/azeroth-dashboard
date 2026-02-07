import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../../entities/auth/account.entity.js';
import { AccountAccess } from '../../entities/auth/account-access.entity.js';
import {
  checkPassword,
  makeRegistrationData,
} from '../auth/srp6.util.js';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account, 'auth')
    private accountRepo: Repository<Account>,
    @InjectRepository(AccountAccess, 'auth')
    private accountAccessRepo: Repository<AccountAccess>,
  ) {}

  async getProfile(accountId: number) {
    const account = await this.accountRepo.findOneByOrFail({ id: accountId });
    const access = await this.accountAccessRepo.findOne({
      where: { id: accountId },
    });

    return {
      id: account.id,
      username: account.username,
      email: account.email,
      joindate: account.joindate,
      lastIp: account.lastIp,
      lastLogin: account.lastLogin,
      expansion: account.expansion,
      gmLevel: access?.gmlevel ?? 0,
    };
  }

  async changePassword(
    accountId: number,
    currentPassword: string,
    newPassword: string,
  ) {
    if (newPassword.length > 16) {
      throw new BadRequestException('Password too long (max 16 characters)');
    }

    const account = await this.accountRepo.findOneByOrFail({ id: accountId });

    if (
      !checkPassword(
        account.username,
        currentPassword,
        account.salt,
        account.verifier,
      )
    ) {
      throw new BadRequestException('Current password is incorrect');
    }

    const { salt, verifier } = makeRegistrationData(
      account.username,
      newPassword,
    );
    await this.accountRepo.update(accountId, { salt, verifier });

    return { message: 'Password changed successfully' };
  }

  async changeEmail(accountId: number, newEmail: string) {
    if (newEmail.length > 255) {
      throw new BadRequestException('Email too long');
    }
    await this.accountRepo.update(accountId, {
      email: newEmail.toUpperCase(),
    });
    return { message: 'Email changed successfully' };
  }
}
