import { Entity, Column, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

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
