import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'account_access' })
export class AccountAccess {
  @PrimaryColumn({ type: 'int', unsigned: true, name: 'AccountID' })
  accountId!: number;

  @Column({ type: 'tinyint', unsigned: true, name: 'SecurityLevel' })
  securityLevel!: number;

  @PrimaryColumn({ type: 'int', name: 'RealmID', default: -1 })
  realmId!: number;

  @Column({ type: 'varchar', length: 255, name: 'Comment', default: '' })
  comment!: string;
}
