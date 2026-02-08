import { Entity, Column, PrimaryColumn } from 'typeorm';

/**
 * Maps to `acore_world.itemrandomsuffix_dbc` (read-only, synchronize: false).
 *
 * Negative randomPropertyId values in item_instance reference this table (use abs(id)).
 * Provides the suffix name and stat allocation percentages.
 */
@Entity({ name: 'itemrandomsuffix_dbc' })
export class ItemRandomSuffix {
  @PrimaryColumn({ type: 'int' })
  ID!: number;

  @Column({ type: 'varchar', length: 100, name: 'Name_Lang_enUS', default: '' })
  nameLangEnUS!: string;

  @Column({ type: 'int', name: 'Enchantment_1', default: 0 })
  enchantment1!: number;
  @Column({ type: 'int', name: 'Enchantment_2', default: 0 })
  enchantment2!: number;
  @Column({ type: 'int', name: 'Enchantment_3', default: 0 })
  enchantment3!: number;
  @Column({ type: 'int', name: 'Enchantment_4', default: 0 })
  enchantment4!: number;
  @Column({ type: 'int', name: 'Enchantment_5', default: 0 })
  enchantment5!: number;

  @Column({ type: 'int', name: 'AllocationPct_1', default: 0 })
  allocationPct1!: number;
  @Column({ type: 'int', name: 'AllocationPct_2', default: 0 })
  allocationPct2!: number;
  @Column({ type: 'int', name: 'AllocationPct_3', default: 0 })
  allocationPct3!: number;
  @Column({ type: 'int', name: 'AllocationPct_4', default: 0 })
  allocationPct4!: number;
  @Column({ type: 'int', name: 'AllocationPct_5', default: 0 })
  allocationPct5!: number;
}
