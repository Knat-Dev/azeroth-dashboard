import { Entity, Column, PrimaryColumn } from 'typeorm';

/**
 * Maps to `acore_characters.item_instance` (read-only, synchronize: false).
 *
 * MySQL indexes (managed by AzerothCore):
 *   - PRIMARY KEY (`guid`)
 *   - INDEX `idx_owner_guid` (`owner_guid`)
 *
 * Implicit relations (no FK constraints in AC schema):
 *   - item_instance.itemEntry  → item_template.entry  (world DB)
 *   - item_instance.owner_guid → characters.guid
 *   - item_instance.guid       → character_inventory.item
 */
@Entity({ name: 'item_instance' })
export class ItemInstance {
  @PrimaryColumn({ type: 'int', unsigned: true })
  guid!: number;

  @Column({ type: 'mediumint', unsigned: true, name: 'itemEntry', default: 0 })
  itemEntry!: number;

  @Column({ type: 'int', unsigned: true, name: 'owner_guid', default: 0 })
  ownerGuid!: number;

  @Column({ type: 'int', unsigned: true, default: 0 })
  count!: number;

  @Column({ type: 'text', nullable: true })
  enchantments!: string | null;

  @Column({ type: 'smallint', default: 0 })
  randomPropertyId!: number;

  @Column({ type: 'int', default: 0 })
  durability!: number;
}
