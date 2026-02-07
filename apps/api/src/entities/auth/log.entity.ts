import { Entity, Column, PrimaryColumn } from 'typeorm';

/**
 * Maps to `acore_auth.logs` (read-only, synchronize: false).
 *
 * MySQL indexes (managed by AzerothCore):
 *   - PRIMARY KEY (`time`, `realm`, `type`)
 *
 * Implicit relations (no FK constraints in AC schema):
 *   - logs.realm → realmlist.id
 */
@Entity({ name: 'logs' })
export class Log {
  @PrimaryColumn({ type: 'int', unsigned: true })
  time!: number;

  @PrimaryColumn({ type: 'int', unsigned: true })
  realm!: number;

  @PrimaryColumn({ type: 'varchar', length: 250 })
  type!: string;

  @Column({ type: 'tinyint', unsigned: true, default: 0 })
  level!: number;

  @Column({ type: 'text', nullable: true })
  string!: string;
}
