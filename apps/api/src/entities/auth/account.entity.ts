import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'account' })
export class Account {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ type: 'varchar', length: 32 })
  username!: string;

  @Column({ type: 'binary', length: 32 })
  salt!: Buffer;

  @Column({ type: 'binary', length: 32 })
  verifier!: Buffer;

  @Column({ type: 'varchar', length: 255, default: '' })
  email!: string;

  @Column({ type: 'varchar', length: 255, name: 'reg_mail', default: '' })
  regMail!: string;

  @Column({ type: 'timestamp', name: 'joindate' })
  joindate!: Date;

  @Column({
    type: 'varchar',
    length: 15,
    name: 'last_ip',
    default: '127.0.0.1',
  })
  lastIp!: string;

  @Column({ type: 'timestamp', name: 'last_login', nullable: true })
  lastLogin!: Date | null;

  @Column({ type: 'tinyint', unsigned: true, default: 0 })
  online!: number;

  @Column({ type: 'tinyint', unsigned: true, default: 2 })
  expansion!: number;

  @Column({ type: 'tinyint', unsigned: true, default: 0 })
  locale!: number;

  @Column({ type: 'tinyint', unsigned: true, default: 0 })
  failed_logins!: number;

  @Column({ type: 'tinyint', unsigned: true, default: 1 })
  locked!: number;

  @Column({ type: 'bigint', unsigned: true, name: 'totaltime', default: 0 })
  totaltime!: number;
}
