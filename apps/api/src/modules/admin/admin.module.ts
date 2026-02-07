import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { DockerModule } from '../docker/docker.module.js';
import { MonitorModule } from '../monitor/monitor.module.js';
import { WebhookModule } from '../webhook/webhook.module.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { SoapService } from './soap.service.js';
import { BroadcastController } from './broadcast.controller.js';
import { BroadcastService } from './broadcast.service.js';
import { LogsController } from './logs.controller.js';
import { LogsService } from './logs.service.js';
import { BackupController } from './backup.controller.js';
import { BackupService } from './backup.service.js';
import { Account } from '../../entities/auth/account.entity.js';
import { AccountAccess } from '../../entities/auth/account-access.entity.js';
import { AccountBanned } from '../../entities/auth/account-banned.entity.js';
import { Autobroadcast } from '../../entities/auth/autobroadcast.entity.js';
import { Character } from '../../entities/characters/character.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [Account, AccountAccess, AccountBanned, Autobroadcast],
      'auth',
    ),
    TypeOrmModule.forFeature([Character], 'characters'),
    AuthModule,
    DockerModule,
    forwardRef(() => MonitorModule),
    forwardRef(() => WebhookModule),
  ],
  controllers: [
    AdminController,
    BroadcastController,
    LogsController,
    BackupController,
  ],
  providers: [
    AdminService,
    SoapService,
    BroadcastService,
    LogsService,
    BackupService,
  ],
  exports: [SoapService],
})
export class AdminModule {}
