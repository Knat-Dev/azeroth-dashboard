import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Maps to `acore_auth.realmlist` (read-only, synchronize: false).
 *
 * MySQL indexes (managed by AzerothCore):
 *   - PRIMARY KEY (`id`)
 *   - UNIQUE `idx_name` (`name`)
 *
 * Referenced by:
 *   - account_access.RealmID → realmlist.id
 *   - autobroadcast.realmid  → realmlist.id
 */
@Entity({ name: 'realmlist' })
export class Realmlist {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ type: 'varchar', length: 32, default: '' })
  name!: string;

  @Column({ type: 'varchar', length: 255, default: '127.0.0.1' })
  address!: string;

  @Column({ type: 'varchar', length: 255, name: 'localAddress', default: '127.0.0.1' })
  localAddress!: string;

  @Column({ type: 'smallint', unsigned: true, default: 8085 })
  port!: number;

  @Column({ type: 'tinyint', unsigned: true, default: 0 })
  icon!: number;

  @Column({ type: 'tinyint', unsigned: true, default: 2 })
  flag!: number;

  @Column({ type: 'tinyint', unsigned: true, default: 1 })
  timezone!: number;

  @Column({ type: 'float', unsigned: true, default: 0 })
  population!: number;
}
