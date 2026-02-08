import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Maps to `acore_auth.ip_banned` (read-only, synchronize: false).
 *
 * MySQL indexes (managed by AzerothCore):
 *   - PRIMARY KEY (`ip`, `bandate`)
 */
@Entity({ name: 'ip_banned' })
export class IpBanned {
  @PrimaryColumn({ type: 'varchar', length: 15 })
  ip!: string;

  @PrimaryColumn({ type: 'int', unsigned: true })
  bandate!: number;

  @Column({ type: 'int', unsigned: true })
  unbandate!: number;

  @Column({ type: 'varchar', length: 50 })
  bannedby!: string;

  @Column({ type: 'varchar', length: 255 })
  banreason!: string;
}
