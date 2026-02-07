import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { AccountsService } from './accounts.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ChangePasswordDto, ChangeEmailDto } from './accounts.dto.js';

@Controller('accounts')
@UseGuards(JwtAuthGuard)
export class AccountsController {
  constructor(private accountsService: AccountsService) {}

  @Get('me')
  getProfile(@CurrentUser() user: { id: number }) {
    return this.accountsService.getProfile(user.id);
  }

  @Patch('me/password')
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

  @Patch('me/email')
  changeEmail(
    @CurrentUser() user: { id: number },
    @Body() dto: ChangeEmailDto,
  ) {
    return this.accountsService.changeEmail(user.id, dto.email);
  }
}
