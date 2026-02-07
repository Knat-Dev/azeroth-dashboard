import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../../entities/auth/account.entity.js';
import { AccountAccess } from '../../entities/auth/account-access.entity.js';
import {
  makeRegistrationData,
  checkPassword,
} from './srp6.util.js';

const MAX_ACCOUNT_STR = 17;
const MAX_PASS_STR = 16;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Account, 'auth')
    private accountRepo: Repository<Account>,
    @InjectRepository(AccountAccess, 'auth')
    private accountAccessRepo: Repository<AccountAccess>,
    private jwtService: JwtService,
  ) {}

  async register(username: string, password: string, email?: string) {
    if (username.length > MAX_ACCOUNT_STR) {
      throw new BadRequestException('Username too long (max 17 characters)');
    }
    if (password.length > MAX_PASS_STR) {
      throw new BadRequestException('Password too long (max 16 characters)');
    }

    const upperUsername = username.toUpperCase();

    const existing = await this.accountRepo.findOne({
      where: { username: upperUsername },
    });
    if (existing) {
      throw new ConflictException('Account already exists');
    }

    const { salt, verifier } = makeRegistrationData(username, password);

    const account = this.accountRepo.create({
      username: upperUsername,
      salt,
      verifier,
      email: email?.toUpperCase() ?? '',
      regMail: email?.toUpperCase() ?? '',
      expansion: 2,
    });

    await this.accountRepo.save(account);

    return this.buildAuthResponse(account, 0);
  }

  async login(username: string, password: string) {
    const upperUsername = username.toUpperCase();

    const account = await this.accountRepo.findOne({
      where: { username: upperUsername },
    });
    if (!account) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!checkPassword(username, password, account.salt, account.verifier)) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const gmLevel = await this.getGmLevel(account.id);

    return this.buildAuthResponse(account, gmLevel);
  }

  async refresh(userId: number) {
    const account = await this.accountRepo.findOne({
      where: { id: userId },
    });
    if (!account) {
      throw new UnauthorizedException('Account not found');
    }

    const gmLevel = await this.getGmLevel(account.id);
    return this.buildAuthResponse(account, gmLevel);
  }

  private async getGmLevel(accountId: number): Promise<number> {
    const access = await this.accountAccessRepo.findOne({
      where: { accountId },
    });
    return access?.securityLevel ?? 0;
  }

  private buildAuthResponse(account: Account, gmLevel: number) {
    const payload = {
      sub: account.id,
      username: account.username,
      gmLevel,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: account.id,
        username: account.username,
        email: account.email,
        gmLevel,
      },
    };
  }
}
