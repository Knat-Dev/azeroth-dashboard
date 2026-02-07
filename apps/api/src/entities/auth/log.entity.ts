import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'logs' })
export class Log {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', unsigned: true })
  time!: number;

  @Column({ type: 'int', unsigned: true })
  realm!: number;

  @Column({ type: 'varchar', length: 250 })
  type!: string;

  @Column({ type: 'tinyint', unsigned: true, default: 0 })
  level!: number;

  @Column({ type: 'text' })
  string!: string;
}
