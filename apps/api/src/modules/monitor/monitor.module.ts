import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DockerModule } from '../docker/docker.module.js';
import { AdminModule } from '../admin/admin.module.js';
import { WebhookModule } from '../webhook/webhook.module.js';
import { MonitorService } from './monitor.service.js';
import { EventService } from './event.service.js';
import { Character } from '../../entities/characters/character.entity.js';

@Module({
  imports: [
    DockerModule,
    forwardRef(() => AdminModule),
    forwardRef(() => WebhookModule),
    TypeOrmModule.forFeature([Character], 'characters'),
  ],
  providers: [MonitorService, EventService],
  exports: [MonitorService, EventService],
})
export class MonitorModule {}
