import { Column, Entity, PrimaryColumn } from 'typeorm';

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
