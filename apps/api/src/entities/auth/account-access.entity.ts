import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Maps to `acore_auth.account_access` (read-only, synchronize: false).
 *
 * MySQL indexes (managed by AzerothCore):
 *   - PRIMARY KEY (`id`, `RealmID`)
 *
 * Implicit relations (no FK constraints in AC schema):
 *   - account_access.id       → account.id
 *   - account_access.RealmID  → realmlist.id  (RealmID = -1 means all realms)
 */
@Entity({ name: 'account_access' })
export class AccountAccess {
  @PrimaryColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ type: 'tinyint', unsigned: true })
  gmlevel!: number;

  @PrimaryColumn({ type: 'int', name: 'RealmID', default: -1 })
  realmId!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  comment!: string;
}
