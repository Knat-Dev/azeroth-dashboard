import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import appConfig from './config/app.config.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { AccountsModule } from './modules/accounts/accounts.module.js';
import { CharactersModule } from './modules/characters/characters.module.js';
import { GuildsModule } from './modules/guilds/guilds.module.js';
import { ServerModule } from './modules/server/server.module.js';
import { AdminModule } from './modules/admin/admin.module.js';

// Auth DB entities
import { Account } from './entities/auth/account.entity.js';
import { AccountAccess } from './entities/auth/account-access.entity.js';
import { AccountBanned } from './entities/auth/account-banned.entity.js';
import { Realmlist } from './entities/auth/realmlist.entity.js';
import { Autobroadcast } from './entities/auth/autobroadcast.entity.js';

// Characters DB entities
import { Character } from './entities/characters/character.entity.js';
import { CharacterInventory } from './entities/characters/character-inventory.entity.js';
import { ItemInstance } from './entities/characters/item-instance.entity.js';
import { Guild } from './entities/characters/guild.entity.js';
import { GuildMember } from './entities/characters/guild-member.entity.js';

// World DB entities
import { ItemTemplate } from './entities/world/item-template.entity.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),

    // Auth database
    TypeOrmModule.forRootAsync({
      name: 'auth',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get('DB_PORT', 3306),
        username: 'root',
        password: config.get('DB_ROOT_PASSWORD', 'password'),
        database: 'acore_auth',
        entities: [
          Account,
          AccountAccess,
          AccountBanned,
          Realmlist,
          Autobroadcast,
        ],
        synchronize: false,
      }),
    }),

    // Characters database
    TypeOrmModule.forRootAsync({
      name: 'characters',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get('DB_PORT', 3306),
        username: 'root',
        password: config.get('DB_ROOT_PASSWORD', 'password'),
        database: 'acore_characters',
        entities: [
          Character,
          CharacterInventory,
          ItemInstance,
          Guild,
          GuildMember,
        ],
        synchronize: false,
      }),
    }),

    // World database (read-only reference)
    TypeOrmModule.forRootAsync({
      name: 'world',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get('DB_PORT', 3306),
        username: 'root',
        password: config.get('DB_ROOT_PASSWORD', 'password'),
        database: 'acore_world',
        entities: [ItemTemplate],
        synchronize: false,
      }),
    }),

    AuthModule,
    AccountsModule,
    CharactersModule,
    GuildsModule,
    ServerModule,
    AdminModule,
  ],
})
export class AppModule {}
