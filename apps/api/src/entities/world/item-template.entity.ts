import { Entity, Column, PrimaryColumn } from 'typeorm';

/**
 * Maps to `acore_world.item_template` (read-only, synchronize: false).
 *
 * MySQL indexes (managed by AzerothCore):
 *   - PRIMARY KEY (`entry`)
 *   - INDEX `idx_name` (`name`)
 *   - INDEX `items_index` (`class`)
 *
 * Referenced by:
 *   - item_instance.itemEntry → item_template.entry  (characters DB)
 */
@Entity({ name: 'item_template' })
export class ItemTemplate {
  @PrimaryColumn({ type: 'mediumint', unsigned: true })
  entry!: number;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'tinyint', unsigned: true, default: 0 })
  class!: number;

  @Column({ type: 'tinyint', unsigned: true, default: 0 })
  subclass!: number;

  @Column({ type: 'tinyint', unsigned: true, name: 'Quality', default: 0 })
  quality!: number;

  @Column({
    type: 'tinyint',
    unsigned: true,
    name: 'InventoryType',
    default: 0,
  })
  inventoryType!: number;

  @Column({ type: 'mediumint', name: 'ItemLevel', default: 0 })
  itemLevel!: number;

  @Column({ type: 'mediumint', unsigned: true, name: 'displayid', default: 0 })
  displayId!: number;

  @Column({ type: 'tinyint', name: 'bonding', default: 0 })
  bonding!: number;

  @Column({ type: 'tinyint', unsigned: true, name: 'RequiredLevel', default: 0 })
  requiredLevel!: number;

  @Column({ type: 'smallint', unsigned: true, name: 'armor', default: 0 })
  armor!: number;

  @Column({ type: 'tinyint', unsigned: true, name: 'stat_type1', default: 0 })
  statType1!: number;
  @Column({ type: 'smallint', name: 'stat_value1', default: 0 })
  statValue1!: number;
  @Column({ type: 'tinyint', unsigned: true, name: 'stat_type2', default: 0 })
  statType2!: number;
  @Column({ type: 'smallint', name: 'stat_value2', default: 0 })
  statValue2!: number;
  @Column({ type: 'tinyint', unsigned: true, name: 'stat_type3', default: 0 })
  statType3!: number;
  @Column({ type: 'smallint', name: 'stat_value3', default: 0 })
  statValue3!: number;
  @Column({ type: 'tinyint', unsigned: true, name: 'stat_type4', default: 0 })
  statType4!: number;
  @Column({ type: 'smallint', name: 'stat_value4', default: 0 })
  statValue4!: number;
  @Column({ type: 'tinyint', unsigned: true, name: 'stat_type5', default: 0 })
  statType5!: number;
  @Column({ type: 'smallint', name: 'stat_value5', default: 0 })
  statValue5!: number;
  @Column({ type: 'tinyint', unsigned: true, name: 'stat_type6', default: 0 })
  statType6!: number;
  @Column({ type: 'smallint', name: 'stat_value6', default: 0 })
  statValue6!: number;
  @Column({ type: 'tinyint', unsigned: true, name: 'stat_type7', default: 0 })
  statType7!: number;
  @Column({ type: 'smallint', name: 'stat_value7', default: 0 })
  statValue7!: number;
  @Column({ type: 'tinyint', unsigned: true, name: 'stat_type8', default: 0 })
  statType8!: number;
  @Column({ type: 'smallint', name: 'stat_value8', default: 0 })
  statValue8!: number;
  @Column({ type: 'tinyint', unsigned: true, name: 'stat_type9', default: 0 })
  statType9!: number;
  @Column({ type: 'smallint', name: 'stat_value9', default: 0 })
  statValue9!: number;
  @Column({ type: 'tinyint', unsigned: true, name: 'stat_type10', default: 0 })
  statType10!: number;
  @Column({ type: 'smallint', name: 'stat_value10', default: 0 })
  statValue10!: number;

  @Column({ type: 'float', name: 'dmg_min1', default: 0 })
  dmgMin1!: number;
  @Column({ type: 'float', name: 'dmg_max1', default: 0 })
  dmgMax1!: number;
  @Column({ type: 'tinyint', unsigned: true, name: 'dmg_type1', default: 0 })
  dmgType1!: number;

  @Column({ type: 'smallint', unsigned: true, name: 'delay', default: 1000 })
  delay!: number;

  @Column({ type: 'smallint', unsigned: true, name: 'MaxDurability', default: 0 })
  maxDurability!: number;

  @Column({ type: 'int', name: 'AllowableClass', default: -1 })
  allowableClass!: number;

  @Column({ type: 'int', name: 'AllowableRace', default: -1 })
  allowableRace!: number;

  @Column({ type: 'int', unsigned: true, name: 'SellPrice', default: 0 })
  sellPrice!: number;

  @Column({ type: 'varchar', length: 255, default: '' })
  description!: string;
}
