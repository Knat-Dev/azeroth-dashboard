import { Entity, Column, PrimaryColumn } from 'typeorm';

/**
 * Maps to `acore_world.randproppoints_dbc` (read-only, synchronize: false).
 *
 * Indexed by ItemLevel. Provides the suffix factor used to compute
 * stat values for items with negative randomPropertyId (random suffix).
 *
 * Column selection: InventoryType → coefficient (0-4), Quality → row set:
 *   Epic = quality 4, Superior = quality 3 (Rare), Good = quality 2 (Uncommon)
 */
@Entity({ name: 'randproppoints_dbc' })
export class RandPropPoints {
  @PrimaryColumn({ type: 'int' })
  ID!: number;

  @Column({ type: 'int', name: 'Epic_1', default: 0 })
  epic1!: number;
  @Column({ type: 'int', name: 'Epic_2', default: 0 })
  epic2!: number;
  @Column({ type: 'int', name: 'Epic_3', default: 0 })
  epic3!: number;
  @Column({ type: 'int', name: 'Epic_4', default: 0 })
  epic4!: number;
  @Column({ type: 'int', name: 'Epic_5', default: 0 })
  epic5!: number;

  @Column({ type: 'int', name: 'Superior_1', default: 0 })
  superior1!: number;
  @Column({ type: 'int', name: 'Superior_2', default: 0 })
  superior2!: number;
  @Column({ type: 'int', name: 'Superior_3', default: 0 })
  superior3!: number;
  @Column({ type: 'int', name: 'Superior_4', default: 0 })
  superior4!: number;
  @Column({ type: 'int', name: 'Superior_5', default: 0 })
  superior5!: number;

  @Column({ type: 'int', name: 'Good_1', default: 0 })
  good1!: number;
  @Column({ type: 'int', name: 'Good_2', default: 0 })
  good2!: number;
  @Column({ type: 'int', name: 'Good_3', default: 0 })
  good3!: number;
  @Column({ type: 'int', name: 'Good_4', default: 0 })
  good4!: number;
  @Column({ type: 'int', name: 'Good_5', default: 0 })
  good5!: number;
}
