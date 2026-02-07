import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../../entities/auth/account.entity.js';
import { AccountAccess } from '../../entities/auth/account-access.entity.js';
import { checkPassword } from './srp6.util.js';

const MIN_GM_LEVEL = 3;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Account, 'auth')
    private accountRepo: Repository<Account>,
    @InjectRepository(AccountAccess, 'auth')
    private accountAccessRepo: Repository<AccountAccess>,
    private jwtService: JwtService,
  ) {}

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

    if (gmLevel < MIN_GM_LEVEL) {
      throw new ForbiddenException(
        'Insufficient privileges. Only GM accounts (level 3+) can access the dashboard.',
      );
    }

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
      where: { id: accountId },
    });
    return access?.gmlevel ?? 0;
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
