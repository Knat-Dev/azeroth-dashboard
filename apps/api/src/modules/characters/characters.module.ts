import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CharactersController } from './characters.controller.js';
import { CharactersService } from './characters.service.js';
import { Character } from '../../entities/characters/character.entity.js';
import { CharacterInventory } from '../../entities/characters/character-inventory.entity.js';
import { ItemInstance } from '../../entities/characters/item-instance.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [Character, CharacterInventory, ItemInstance],
      'characters',
    ),
  ],
  controllers: [CharactersController],
  providers: [CharactersService],
  exports: [CharactersService],
})
export class CharactersModule {}
