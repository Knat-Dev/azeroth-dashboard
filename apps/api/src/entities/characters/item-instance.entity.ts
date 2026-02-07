import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ name: 'item_instance' })
export class ItemInstance {
  @PrimaryColumn({ type: 'int', unsigned: true })
  guid!: number;

  @Column({ type: 'mediumint', unsigned: true, name: 'itemEntry', default: 0 })
  itemEntry!: number;

  @Column({ type: 'int', unsigned: true, name: 'owner_guid', default: 0 })
  ownerGuid!: number;

  @Column({ type: 'int', unsigned: true, default: 0 })
  count!: number;

  @Column({ type: 'text', nullable: true })
  enchantments!: string | null;

  @Column({ type: 'int', default: 0 })
  durability!: number;
}
