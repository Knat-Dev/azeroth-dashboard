import { Entity, Column, PrimaryColumn } from 'typeorm';

/**
 * Maps to `acore_world.scalingstatvalues_dbc` (read-only, synchronize: false).
 *
 * One row per character level. Provides the base stat budgets used
 * by heirloom items to compute scaled stat values.
 *
 * The ScalingStatValue bitmask on item_template selects which column to use.
 */
@Entity({ name: 'scalingstatvalues_dbc' })
export class ScalingStatValues {
  @PrimaryColumn({ type: 'int' })
  ID!: number;

  @Column({ type: 'int', name: 'Charlevel', default: 0 })
  charlevel!: number;

  // Stat budget columns — selected by ScalingStatValue bitmask
  @Column({ type: 'int', name: 'ShoulderBudget', default: 0 })
  shoulderBudget!: number;

  @Column({ type: 'int', name: 'TrinketBudget', default: 0 })
  trinketBudget!: number;

  @Column({ type: 'int', name: 'WeaponBudget1H', default: 0 })
  weaponBudget1H!: number;

  @Column({ type: 'int', name: 'RangedBudget', default: 0 })
  rangedBudget!: number;

  @Column({ type: 'int', name: 'PrimaryBudget', default: 0 })
  primaryBudget!: number;

  @Column({ type: 'int', name: 'TertiaryBudget', default: 0 })
  tertiaryBudget!: number;

  // Armor columns — selected by ScalingStatValue bitmask for armor scaling
  @Column({ type: 'int', name: 'ClothCloakArmor', default: 0 })
  clothCloakArmor!: number;
  @Column({ type: 'int', name: 'ClothShoulderArmor', default: 0 })
  clothShoulderArmor!: number;
  @Column({ type: 'int', name: 'LeatherShoulderArmor', default: 0 })
  leatherShoulderArmor!: number;
  @Column({ type: 'int', name: 'MailShoulderArmor', default: 0 })
  mailShoulderArmor!: number;
  @Column({ type: 'int', name: 'PlateShoulderArmor', default: 0 })
  plateShoulderArmor!: number;

  @Column({ type: 'int', name: 'ClothChestArmor', default: 0 })
  clothChestArmor!: number;
  @Column({ type: 'int', name: 'LeatherChestArmor', default: 0 })
  leatherChestArmor!: number;
  @Column({ type: 'int', name: 'MailChestArmor', default: 0 })
  mailChestArmor!: number;
  @Column({ type: 'int', name: 'PlateChestArmor', default: 0 })
  plateChestArmor!: number;

  // DPS columns
  @Column({ type: 'int', name: 'WeaponDPS1H', default: 0 })
  weaponDPS1H!: number;
  @Column({ type: 'int', name: 'WeaponDPS2H', default: 0 })
  weaponDPS2H!: number;
  @Column({ type: 'int', name: 'SpellcasterDPS1H', default: 0 })
  spellcasterDPS1H!: number;
  @Column({ type: 'int', name: 'SpellcasterDPS2H', default: 0 })
  spellcasterDPS2H!: number;
  @Column({ type: 'int', name: 'RangedDPS', default: 0 })
  rangedDPS!: number;
  @Column({ type: 'int', name: 'WandDPS', default: 0 })
  wandDPS!: number;

  @Column({ type: 'int', name: 'SpellPower', default: 0 })
  spellPower!: number;
}
