import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ name: 'guild' })
export class Guild {
  @PrimaryColumn({ type: 'int', unsigned: true })
  guildid!: number;

  @Column({ type: 'varchar', length: 24 })
  name!: string;

  @Column({ type: 'int', unsigned: true })
  leaderguid!: number;

  @Column({ type: 'tinyint', unsigned: true })
  EmblemStyle!: number;

  @Column({ type: 'tinyint', unsigned: true })
  EmblemColor!: number;

  @Column({ type: 'tinyint', unsigned: true })
  BorderStyle!: number;

  @Column({ type: 'tinyint', unsigned: true })
  BorderColor!: number;

  @Column({ type: 'tinyint', unsigned: true })
  BackgroundColor!: number;

  @Column({ type: 'varchar', length: 500, default: '' })
  info!: string;

  @Column({ type: 'varchar', length: 128, default: '' })
  motd!: string;

  @Column({ type: 'int', unsigned: true, default: 0 })
  createdate!: number;
}
