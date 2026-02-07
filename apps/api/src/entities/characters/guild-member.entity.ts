import { Entity, Column, PrimaryColumn } from 'typeorm';

/**
 * Maps to `acore_characters.guild_member` (read-only, synchronize: false).
 *
 * MySQL indexes (managed by AzerothCore):
 *   - PRIMARY KEY (`guid`)
 *   - UNIQUE `idx_guild_guid` (`guildid`, `guid`)
 *   - INDEX `idx_guildid` (`guildid`)
 *
 * Implicit relations (no FK constraints in AC schema):
 *   - guild_member.guid    → characters.guid
 *   - guild_member.guildid → guild.guildid
 */
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
