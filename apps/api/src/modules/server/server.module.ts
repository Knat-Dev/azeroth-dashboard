import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServerController } from './server.controller.js';
import { ServerService } from './server.service.js';
import { MonitorModule } from '../monitor/monitor.module.js';
import { Realmlist } from '../../entities/auth/realmlist.entity.js';
import { Character } from '../../entities/characters/character.entity.js';
import { Guild } from '../../entities/characters/guild.entity.js';
import { GuildMember } from '../../entities/characters/guild-member.entity.js';
import { ItemTemplate } from '../../entities/world/item-template.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Realmlist], 'auth'),
    TypeOrmModule.forFeature([Character, Guild, GuildMember], 'characters'),
    TypeOrmModule.forFeature([ItemTemplate], 'world'),
    MonitorModule,
  ],
  controllers: [ServerController],
  providers: [ServerService],
  exports: [ServerService],
})
export class ServerModule {}
