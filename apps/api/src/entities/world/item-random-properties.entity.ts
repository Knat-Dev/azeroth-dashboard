import { Entity, Column, PrimaryColumn } from 'typeorm';

/**
 * Maps to `acore_world.itemrandomproperties_dbc` (read-only, synchronize: false).
 *
 * Positive randomPropertyId values in item_instance reference this table.
 * Provides the suffix name (e.g. "of the Falcon").
 */
@Entity({ name: 'itemrandomproperties_dbc' })
export class ItemRandomProperties {
  @PrimaryColumn({ type: 'int' })
  ID!: number;

  @Column({ type: 'varchar', length: 100, name: 'Name_Lang_enUS', default: '' })
  nameLangEnUS!: string;
}
