import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AccountsService } from './accounts.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ChangePasswordDto, ChangeEmailDto } from './accounts.dto.js';

@ApiTags('Accounts')
@ApiBearerAuth()
@Controller('accounts')
@UseGuards(JwtAuthGuard)
export class AccountsController {
  constructor(private accountsService: AccountsService) {}

  @ApiOperation({ summary: 'Get current user profile' })
  @Get('me')
  getProfile(@CurrentUser() user: { id: number }) {
    return this.accountsService.getProfile(user.id);
  }

  @ApiOperation({ summary: 'Change account password' })
  @Patch('me/password')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  changePassword(
    @CurrentUser() user: { id: number },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.accountsService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @ApiOperation({ summary: 'Change account email' })
  @Patch('me/email')
  changeEmail(
    @CurrentUser() user: { id: number },
    @Body() dto: ChangeEmailDto,
  ) {
    return this.accountsService.changeEmail(user.id, dto.email);
  }
}
