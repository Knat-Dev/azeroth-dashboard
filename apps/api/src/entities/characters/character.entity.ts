import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ name: 'characters' })
export class Character {
  @PrimaryColumn({ type: 'int', unsigned: true })
  guid!: number;

  @Column({ type: 'int', unsigned: true })
  account!: number;

  @Column({ type: 'varchar', length: 12 })
  name!: string;

  @Column({ type: 'tinyint', unsigned: true })
  race!: number;

  @Column({ type: 'tinyint', unsigned: true })
  class!: number;

  @Column({ type: 'tinyint', unsigned: true })
  gender!: number;

  @Column({ type: 'tinyint', unsigned: true, default: 0 })
  level!: number;

  @Column({ type: 'int', unsigned: true, default: 0 })
  money!: number;

  @Column({ type: 'tinyint', unsigned: true, default: 0 })
  online!: number;

  @Column({ type: 'int', unsigned: true, default: 0 })
  totaltime!: number;

  @Column({ type: 'smallint', unsigned: true, default: 0 })
  zone!: number;

  @Column({ type: 'smallint', unsigned: true, default: 0 })
  map!: number;

  @Column({ type: 'int', unsigned: true, default: 0 })
  health!: number;

  @Column({ type: 'int', unsigned: true, default: 0 })
  power1!: number;

  @Column({ type: 'int', unsigned: true, default: 0 })
  power2!: number;

  @Column({ type: 'int', unsigned: true, default: 0 })
  power3!: number;

  @Column({ type: 'text', nullable: true })
  equipmentCache!: string | null;

  @Column({ type: 'float', name: 'position_x', default: 0 })
  positionX!: number;

  @Column({ type: 'float', name: 'position_y', default: 0 })
  positionY!: number;

  @Column({ type: 'float', name: 'position_z', default: 0 })
  positionZ!: number;

  @Column({ type: 'int', unsigned: true, name: 'totalKills', default: 0 })
  totalKills!: number;

  @Column({ type: 'smallint', unsigned: true, name: 'arenaPoints', default: 0 })
  arenaPoints!: number;

  @Column({ type: 'int', unsigned: true, name: 'totalHonorPoints', default: 0 })
  totalHonorPoints!: number;
}
