import { Entity, Column, PrimaryColumn } from 'typeorm';

/**
 * Maps to `acore_world.scalingstatdistribution_dbc` (read-only, synchronize: false).
 *
 * Used by heirloom items (quality 7) to determine which stats scale and by how much.
 * Referenced via item_template.ScalingStatDistribution.
 */
@Entity({ name: 'scalingstatdistribution_dbc' })
export class ScalingStatDistribution {
  @PrimaryColumn({ type: 'int' })
  ID!: number;

  @Column({ type: 'int', name: 'StatID_1', default: -1 })
  statId1!: number;
  @Column({ type: 'int', name: 'StatID_2', default: -1 })
  statId2!: number;
  @Column({ type: 'int', name: 'StatID_3', default: -1 })
  statId3!: number;
  @Column({ type: 'int', name: 'StatID_4', default: -1 })
  statId4!: number;
  @Column({ type: 'int', name: 'StatID_5', default: -1 })
  statId5!: number;
  @Column({ type: 'int', name: 'StatID_6', default: -1 })
  statId6!: number;
  @Column({ type: 'int', name: 'StatID_7', default: -1 })
  statId7!: number;
  @Column({ type: 'int', name: 'StatID_8', default: -1 })
  statId8!: number;
  @Column({ type: 'int', name: 'StatID_9', default: -1 })
  statId9!: number;
  @Column({ type: 'int', name: 'StatID_10', default: -1 })
  statId10!: number;

  @Column({ type: 'int', name: 'Bonus_1', default: 0 })
  bonus1!: number;
  @Column({ type: 'int', name: 'Bonus_2', default: 0 })
  bonus2!: number;
  @Column({ type: 'int', name: 'Bonus_3', default: 0 })
  bonus3!: number;
  @Column({ type: 'int', name: 'Bonus_4', default: 0 })
  bonus4!: number;
  @Column({ type: 'int', name: 'Bonus_5', default: 0 })
  bonus5!: number;
  @Column({ type: 'int', name: 'Bonus_6', default: 0 })
  bonus6!: number;
  @Column({ type: 'int', name: 'Bonus_7', default: 0 })
  bonus7!: number;
  @Column({ type: 'int', name: 'Bonus_8', default: 0 })
  bonus8!: number;
  @Column({ type: 'int', name: 'Bonus_9', default: 0 })
  bonus9!: number;
  @Column({ type: 'int', name: 'Bonus_10', default: 0 })
  bonus10!: number;

  @Column({ type: 'int', name: 'Maxlevel', default: 0 })
  maxlevel!: number;
}
