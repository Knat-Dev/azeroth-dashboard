import { Entity, Column, PrimaryColumn } from 'typeorm';

/**
 * Maps to `acore_world.spellitemenchantment_dbc` (read-only, synchronize: false).
 *
 * Used to resolve what stats an enchantment grants.
 * Effect type 5 = ITEM_ENCHANTMENT_TYPE_STAT, with EffectArg = stat type.
 */
@Entity({ name: 'spellitemenchantment_dbc' })
export class SpellItemEnchantment {
  @PrimaryColumn({ type: 'int' })
  ID!: number;

  @Column({ type: 'int', name: 'Effect_1', default: 0 })
  effect1!: number;
  @Column({ type: 'int', name: 'Effect_2', default: 0 })
  effect2!: number;
  @Column({ type: 'int', name: 'Effect_3', default: 0 })
  effect3!: number;

  @Column({ type: 'int', name: 'EffectPointsMin_1', default: 0 })
  effectPointsMin1!: number;
  @Column({ type: 'int', name: 'EffectPointsMin_2', default: 0 })
  effectPointsMin2!: number;
  @Column({ type: 'int', name: 'EffectPointsMin_3', default: 0 })
  effectPointsMin3!: number;

  @Column({ type: 'int', name: 'EffectArg_1', default: 0 })
  effectArg1!: number;
  @Column({ type: 'int', name: 'EffectArg_2', default: 0 })
  effectArg2!: number;
  @Column({ type: 'int', name: 'EffectArg_3', default: 0 })
  effectArg3!: number;
}
