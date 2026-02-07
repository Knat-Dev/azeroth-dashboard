import { Entity, Column, PrimaryColumn } from 'typeorm';

/**
 * Maps to `acore_characters.character_inventory` (read-only, synchronize: false).
 *
 * MySQL indexes (managed by AzerothCore):
 *   - PRIMARY KEY (`guid`, `item`)  — unique item placement per character
 *   - INDEX `idx_guid` (`guid`)
 *
 * Implicit relations (no FK constraints in AC schema):
 *   - character_inventory.guid → characters.guid
 *   - character_inventory.item → item_instance.guid
 */
@Entity({ name: 'character_inventory' })
export class CharacterInventory {
  @PrimaryColumn({ type: 'int', unsigned: true })
  guid!: number;

  @Column({ type: 'tinyint', unsigned: true })
  bag!: number;

  @Column({ type: 'tinyint', unsigned: true })
  slot!: number;

  @PrimaryColumn({ type: 'int', unsigned: true })
  item!: number;
}
