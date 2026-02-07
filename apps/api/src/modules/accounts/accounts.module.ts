import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsController } from './accounts.controller.js';
import { AccountsService } from './accounts.service.js';
import { Account } from '../../entities/auth/account.entity.js';
import { AccountAccess } from '../../entities/auth/account-access.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Account, AccountAccess], 'auth')],
  controllers: [AccountsController],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
