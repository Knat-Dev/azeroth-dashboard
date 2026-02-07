import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ name: 'character_inventory' })
export class CharacterInventory {
  @PrimaryColumn({ type: 'int', unsigned: true })
  guid!: number;

  @Column({ type: 'tinyint', unsigned: true })
  bag!: number;

  @Column({ type: 'tinyint', unsigned: true })
  slot!: number;

  @PrimaryColumn({ type: 'int', unsigned: true })
  item!: number;
}
