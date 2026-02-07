import { Column, Entity, PrimaryColumn } from 'typeorm';

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
