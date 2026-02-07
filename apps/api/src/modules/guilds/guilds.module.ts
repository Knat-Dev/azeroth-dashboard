import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuildsController } from './guilds.controller.js';
import { GuildsService } from './guilds.service.js';
import { Guild } from '../../entities/characters/guild.entity.js';
import { GuildMember } from '../../entities/characters/guild-member.entity.js';
import { Character } from '../../entities/characters/character.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Guild, GuildMember, Character], 'characters'),
  ],
  controllers: [GuildsController],
  providers: [GuildsService],
  exports: [GuildsService],
})
export class GuildsModule {}
