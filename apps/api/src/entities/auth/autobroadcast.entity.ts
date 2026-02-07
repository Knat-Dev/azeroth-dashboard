import { Entity, Column, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Maps to `acore_auth.autobroadcast` (read-only, synchronize: false).
 *
 * MySQL indexes (managed by AzerothCore):
 *   - PRIMARY KEY (`realmid`, `id`)
 *   - `id` is AUTO_INCREMENT within each realm
 *
 * Implicit relations (no FK constraints in AC schema):
 *   - autobroadcast.realmid → realmlist.id
 */
@Entity({ name: 'autobroadcast' })
export class Autobroadcast {
  @PrimaryColumn({ type: 'int', name: 'realmid', default: -1 })
  realmid!: number;

  @PrimaryGeneratedColumn({ type: 'tinyint', unsigned: true })
  id!: number;

  @Column({ type: 'tinyint', unsigned: true, default: 1 })
  weight!: number;

  @Column({ type: 'longtext' })
  text!: string;
}
