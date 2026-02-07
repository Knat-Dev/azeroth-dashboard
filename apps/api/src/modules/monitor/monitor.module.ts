import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DockerModule } from '../docker/docker.module.js';
import { AdminModule } from '../admin/admin.module.js';
import { MonitorService } from './monitor.service.js';
import { Character } from '../../entities/characters/character.entity.js';

@Module({
  imports: [
    DockerModule,
    AdminModule,
    TypeOrmModule.forFeature([Character], 'characters'),
  ],
  providers: [MonitorService],
  exports: [MonitorService],
})
export class MonitorModule {}
