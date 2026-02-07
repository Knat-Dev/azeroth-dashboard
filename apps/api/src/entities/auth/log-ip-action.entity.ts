import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Maps to `acore_auth.logs_ip_actions` (read-only, synchronize: false).
 *
 * MySQL indexes (managed by AzerothCore):
 *   - PRIMARY KEY (`id`)
 *   - INDEX `idx_account_id` (`account_id`)
 *   - INDEX `idx_ip` (`ip`)
 *
 * Implicit relations (no FK constraints in AC schema):
 *   - logs_ip_actions.account_id    → account.id
 *   - logs_ip_actions.character_guid → characters.guid  (characters DB)
 */
@Entity({ name: 'logs_ip_actions' })
export class LogIpAction {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ type: 'int', unsigned: true })
  account_id!: number;

  @Column({ type: 'int', unsigned: true })
  character_guid!: number;

  @Column({ type: 'tinyint', unsigned: true })
  type!: number;

  @Column({ type: 'varchar', length: 15, default: '127.0.0.1' })
  ip!: string;

  @Column({ type: 'text', nullable: true })
  systemnote!: string | null;

  @Column({ type: 'int', unsigned: true })
  unixtime!: number;

  @Column({ type: 'timestamp' })
  time!: Date;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;
}
