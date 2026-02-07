import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ name: 'item_template' })
export class ItemTemplate {
  @PrimaryColumn({ type: 'mediumint', unsigned: true })
  entry!: number;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'tinyint', unsigned: true, default: 0 })
  class!: number;

  @Column({ type: 'tinyint', unsigned: true, default: 0 })
  subclass!: number;

  @Column({ type: 'tinyint', unsigned: true, name: 'Quality', default: 0 })
  quality!: number;

  @Column({ type: 'tinyint', unsigned: true, name: 'InventoryType', default: 0 })
  inventoryType!: number;

  @Column({ type: 'mediumint', name: 'ItemLevel', default: 0 })
  itemLevel!: number;

  @Column({ type: 'mediumint', unsigned: true, name: 'displayid', default: 0 })
  displayId!: number;

  @Column({ type: 'varchar', length: 255, default: '' })
  description!: string;
}
