import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ name: 'guild_member' })
export class GuildMember {
  @Column({ type: 'int', unsigned: true })
  guildid!: number;

  @PrimaryColumn({ type: 'int', unsigned: true })
  guid!: number;

  @Column({ type: 'tinyint', unsigned: true, name: 'rank' })
  rank!: number;

  @Column({ type: 'varchar', length: 31, default: '' })
  pnote!: string;

  @Column({ type: 'varchar', length: 31, default: '' })
  offnote!: string;
}
