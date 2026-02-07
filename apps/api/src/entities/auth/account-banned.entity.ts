import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Maps to `acore_auth.account_banned` (read-only, synchronize: false).
 *
 * MySQL indexes (managed by AzerothCore):
 *   - PRIMARY KEY (`id`, `bandate`)
 *   - INDEX `idx_active` (`active`)
 *
 * Implicit relations (no FK constraints in AC schema):
 *   - account_banned.id → account.id
 */
@Entity({ name: 'account_banned' })
export class AccountBanned {
  @PrimaryColumn({ type: 'int', unsigned: true, name: 'id' })
  id!: number;

  @PrimaryColumn({ type: 'bigint', unsigned: true, name: 'bandate' })
  bandate!: number;

  @Column({ type: 'bigint', unsigned: true, name: 'unbandate' })
  unbandate!: number;

  @Column({ type: 'varchar', length: 50, name: 'bannedby' })
  bannedby!: string;

  @Column({ type: 'varchar', length: 255, name: 'banreason' })
  banreason!: string;

  @Column({ type: 'tinyint', unsigned: true, name: 'active', default: 1 })
  active!: number;
}
