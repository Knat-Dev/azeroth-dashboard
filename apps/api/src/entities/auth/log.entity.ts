import { Entity, Column, PrimaryColumn } from 'typeorm';

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
