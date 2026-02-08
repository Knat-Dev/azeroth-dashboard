import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SetupController } from './setup.controller.js';
import { SetupService } from './setup.service.js';
import { AdminModule } from '../admin/admin.module.js';
import { MonitorModule } from '../monitor/monitor.module.js';
import { AccountAccess } from '../../entities/auth/account-access.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([AccountAccess], 'auth'),
    AdminModule,
    MonitorModule,
  ],
  controllers: [SetupController],
  providers: [SetupService],
})
export class SetupModule {}
