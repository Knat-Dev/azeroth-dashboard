import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServerController } from './server.controller.js';
import { ServerService } from './server.service.js';
import { DbcSeedService } from './dbc-seed.service.js';
import { MonitorModule } from '../monitor/monitor.module.js';
import { Realmlist } from '../../entities/auth/realmlist.entity.js';
import { Character } from '../../entities/characters/character.entity.js';
import { CharacterInventory } from '../../entities/characters/character-inventory.entity.js';
import { ItemInstance } from '../../entities/characters/item-instance.entity.js';
import { Guild } from '../../entities/characters/guild.entity.js';
import { GuildMember } from '../../entities/characters/guild-member.entity.js';
import { ItemTemplate } from '../../entities/world/item-template.entity.js';
import { ItemRandomProperties } from '../../entities/world/item-random-properties.entity.js';
import { ItemRandomSuffix } from '../../entities/world/item-random-suffix.entity.js';
import { ScalingStatDistribution } from '../../entities/world/scaling-stat-distribution.entity.js';
import { ScalingStatValues } from '../../entities/world/scaling-stat-values.entity.js';
import { SpellItemEnchantment } from '../../entities/world/spell-item-enchantment.entity.js';
import { RandPropPoints } from '../../entities/world/rand-prop-points.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Realmlist], 'auth'),
    TypeOrmModule.forFeature(
      [Character, CharacterInventory, ItemInstance, Guild, GuildMember],
      'characters',
    ),
    TypeOrmModule.forFeature(
      [
        ItemTemplate,
        ItemRandomProperties,
        ItemRandomSuffix,
        ScalingStatDistribution,
        ScalingStatValues,
        SpellItemEnchantment,
        RandPropPoints,
      ],
      'world',
    ),
    MonitorModule,
  ],
  controllers: [ServerController],
  providers: [ServerService, DbcSeedService],
  exports: [ServerService],
})
export class ServerModule {}
