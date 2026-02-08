import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import type { ItemTooltipData, EquippedItemSlot } from '@repo/shared';
import { Realmlist } from '../../entities/auth/realmlist.entity.js';
import { Character } from '../../entities/characters/character.entity.js';
import { CharacterInventory } from '../../entities/characters/character-inventory.entity.js';
import { ItemInstance } from '../../entities/characters/item-instance.entity.js';
import { Guild } from '../../entities/characters/guild.entity.js';
import { GuildMember } from '../../entities/characters/guild-member.entity.js';
import { ItemTemplate } from '../../entities/world/item-template.entity.js';
import { ItemRandomProperties } from '../../entities/world/item-random-properties.entity.js';
import { ItemRandomSuffix } from '../../entities/world/item-random-suffix.entity.js';
import { ScalingStatDistribution } from '../../entities/world/scaling-stat-distribution.entity.js';
import { ScalingStatValues } from '../../entities/world/scaling-stat-values.entity.js';
import { SpellItemEnchantment } from '../../entities/world/spell-item-enchantment.entity.js';
import { RandPropPoints } from '../../entities/world/rand-prop-points.entity.js';

/** ScalingStatValue bitmask → budget column mapping */
const SSV_BUDGET_MAP: { mask: number; key: keyof ScalingStatValues }[] = [
  { mask: 0x00001, key: 'shoulderBudget' },
  { mask: 0x00002, key: 'trinketBudget' },
  { mask: 0x00004, key: 'weaponBudget1H' },
  { mask: 0x00008, key: 'primaryBudget' },
  { mask: 0x00010, key: 'rangedBudget' },
  { mask: 0x40000, key: 'tertiaryBudget' },
];

const TOTAL_EQUIPMENT_SLOTS = 23; // 0-18 equipment + 19-22 bags

@Injectable()
export class ServerService {
  constructor(
    @InjectRepository(Realmlist, 'auth')
    private realmRepo: Repository<Realmlist>,
    @InjectRepository(Character, 'characters')
    private characterRepo: Repository<Character>,
    @InjectRepository(CharacterInventory, 'characters')
    private inventoryRepo: Repository<CharacterInventory>,
    @InjectRepository(ItemInstance, 'characters')
    private itemInstanceRepo: Repository<ItemInstance>,
    @InjectRepository(Guild, 'characters')
    private guildRepo: Repository<Guild>,
    @InjectRepository(GuildMember, 'characters')
    private guildMemberRepo: Repository<GuildMember>,
    @InjectRepository(ItemTemplate, 'world')
    private itemTemplateRepo: Repository<ItemTemplate>,
    @InjectRepository(ItemRandomProperties, 'world')
    private randomPropsRepo: Repository<ItemRandomProperties>,
    @InjectRepository(ItemRandomSuffix, 'world')
    private randomSuffixRepo: Repository<ItemRandomSuffix>,
    @InjectRepository(ScalingStatDistribution, 'world')
    private ssdRepo: Repository<ScalingStatDistribution>,
    @InjectRepository(ScalingStatValues, 'world')
    private ssvRepo: Repository<ScalingStatValues>,
    @InjectRepository(SpellItemEnchantment, 'world')
    private enchantmentRepo: Repository<SpellItemEnchantment>,
    @InjectRepository(RandPropPoints, 'world')
    private randPropPointsRepo: Repository<RandPropPoints>,
  ) {}

  async getOnlineCount(): Promise<number> {
    try {
      return await this.characterRepo.count({
        where: { online: 1 },
      });
    } catch {
      return 0;
    }
  }

  async getRealmName(): Promise<string> {
    try {
      const realm = await this.realmRepo.findOne({ where: {} });
      return realm?.name ?? 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  async getStatus() {
    const realms = await this.realmRepo.find();
    const onlineCount = await this.getOnlineCount();

    const realm = realms[0];
    return {
      online: !!realm,
      playerCount: onlineCount,
      realmName: realm?.name ?? 'Unknown',
      realms: realms.map((r) => ({
        id: r.id,
        name: r.name,
        address: r.address,
        port: r.port,
        population: r.population,
      })),
    };
  }

  async getStats() {
    const [totalAccounts] = await this.realmRepo.manager
      .getRepository('Account')
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .getRawMany();

    const onlineCount = await this.getOnlineCount();
    const totalCharacters = await this.characterRepo.count();

    return {
      totalAccounts: parseInt(totalAccounts?.count ?? '0', 10),
      onlinePlayers: onlineCount,
      totalCharacters,
    };
  }

  async getRealms() {
    return this.realmRepo.find();
  }

  async getOnlinePlayers(page = 1, limit = 20, search?: string) {
    const qb = this.characterRepo
      .createQueryBuilder('c')
      .select([
        'c.guid',
        'c.name',
        'c.level',
        'c.class',
        'c.race',
        'c.gender',
        'c.zone',
        'c.map',
        'c.money',
        'c.totaltime',
      ])
      .where('c.online = 1');

    if (search) {
      qb.andWhere('LOWER(c.name) LIKE LOWER(:search)', {
        search: `%${search}%`,
      });
    }

    const [characters, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Fetch guild names for these characters
    const guids = characters.map((c) => c.guid);
    const guildMap = new Map<number, string>();
    if (guids.length > 0) {
      const guildMembers = await this.guildMemberRepo
        .createQueryBuilder('gm')
        .innerJoin(Guild, 'g', 'g.guildid = gm.guildid')
        .addSelect('g.name', 'guildName')
        .where('gm.guid IN (:...guids)', { guids })
        .getRawAndEntities();

      for (let i = 0; i < guildMembers.entities.length; i++) {
        const entity = guildMembers.entities[i];
        const raw = guildMembers.raw[i];
        if (entity && raw) {
          guildMap.set(entity.guid, raw.guildName ?? null);
        }
      }
    }

    const data = characters.map((c) => ({
      guid: c.guid,
      name: c.name,
      level: c.level,
      class: c.class,
      race: c.race,
      gender: c.gender,
      zone: c.zone,
      map: c.map,
      money: c.money,
      totaltime: c.totaltime,
      guildName: guildMap.get(c.guid) ?? null,
    }));

    return { data, total, page, limit };
  }

  async getPlayerDetail(guid: number) {
    const character = await this.characterRepo.findOne({ where: { guid } });
    if (!character) {
      throw new NotFoundException('Character not found');
    }

    // Get guild info
    let guildName: string | null = null;
    let guildRank: number | null = null;
    const guildMember = await this.guildMemberRepo.findOne({
      where: { guid },
    });
    if (guildMember) {
      const guild = await this.guildRepo.findOne({
        where: { guildid: guildMember.guildid },
      });
      guildName = guild?.name ?? null;
      guildRank = guildMember.rank;
    }

    return {
      guid: character.guid,
      name: character.name,
      level: character.level,
      class: character.class,
      race: character.race,
      gender: character.gender,
      zone: character.zone,
      map: character.map,
      money: character.money,
      totaltime: character.totaltime,
      totalKills: character.totalKills,
      arenaPoints: character.arenaPoints,
      totalHonorPoints: character.totalHonorPoints,
      health: character.health,
      power1: character.power1,
      positionX: character.positionX,
      positionY: character.positionY,
      positionZ: character.positionZ,
      account: character.account,
      online: character.online,
      equipmentCache: character.equipmentCache,
      guildName,
      guildRank,
    };
  }

  async getDistribution() {
    const classRows = await this.characterRepo
      .createQueryBuilder('c')
      .select('c.class', 'id')
      .addSelect('COUNT(*)', 'count')
      .groupBy('c.class')
      .getRawMany();

    const raceRows = await this.characterRepo
      .createQueryBuilder('c')
      .select('c.race', 'id')
      .addSelect('COUNT(*)', 'count')
      .groupBy('c.race')
      .getRawMany();

    return {
      classes: classRows.map((r) => ({
        id: parseInt(r.id, 10),
        count: parseInt(r.count, 10),
      })),
      races: raceRows.map((r) => ({
        id: parseInt(r.id, 10),
        count: parseInt(r.count, 10),
      })),
    };
  }

  async getEquippedItems(
    guid: number,
    level: number,
  ): Promise<EquippedItemSlot[]> {
    // 1. Get all equipped inventory rows (bag=0, slots 0-22)
    const inventory = await this.inventoryRepo.find({
      where: { guid, bag: 0 },
    });

    if (inventory.length === 0) {
      return Array.from({ length: TOTAL_EQUIPMENT_SLOTS }, (_, i) => ({
        slot: i,
        item: null,
      }));
    }

    // Build slot → item_instance guid map
    const slotToItemGuid = new Map<number, number>();
    for (const inv of inventory) {
      if (inv.slot < TOTAL_EQUIPMENT_SLOTS) {
        slotToItemGuid.set(inv.slot, inv.item);
      }
    }

    // 2. Batch fetch item_instance rows
    const itemGuids = [...slotToItemGuid.values()];
    const instances = await this.itemInstanceRepo.find({
      where: { guid: In(itemGuids) },
    });
    const instanceMap = new Map(instances.map((i) => [i.guid, i]));

    // 3. Batch fetch item_template rows
    const entryIds = [...new Set(instances.map((i) => i.itemEntry))];
    const templates =
      entryIds.length > 0
        ? await this.itemTemplateRepo.find({ where: { entry: In(entryIds) } })
        : [];
    const templateMap = new Map(templates.map((t) => [t.entry, t]));

    // 4. Collect randomPropertyIds that need suffix resolution
    const positiveRPIds: number[] = [];
    const negativeRPIds: number[] = [];
    for (const inst of instances) {
      if (inst.randomPropertyId > 0) positiveRPIds.push(inst.randomPropertyId);
      else if (inst.randomPropertyId < 0)
        negativeRPIds.push(Math.abs(inst.randomPropertyId));
    }

    // Batch fetch suffix data
    const [randomPropsMap, randomSuffixMap] = await Promise.all([
      this.batchFetchRandomProperties(positiveRPIds),
      this.batchFetchRandomSuffixes(negativeRPIds),
    ]);

    // 4b. Collect enchantment IDs from instances with random properties
    // and batch-fetch enchantment data + rand prop points
    const allEnchantIds = new Set<number>();
    const allItemLevels = new Set<number>();
    for (const inst of instances) {
      if (inst.randomPropertyId === 0) continue;
      const enchIds = this.parseRandomEnchantmentIds(inst.enchantments);
      for (const id of enchIds) if (id > 0) allEnchantIds.add(id);
      const tmpl = templateMap.get(inst.itemEntry);
      if (tmpl && inst.randomPropertyId < 0) allItemLevels.add(tmpl.itemLevel);
    }
    const [enchantmentMap, randPropPointsMap] = await Promise.all([
      this.batchFetchEnchantments([...allEnchantIds]),
      this.batchFetchRandPropPoints([...allItemLevels]),
    ]);

    // 5. Collect scaling stat distribution IDs for heirloom items
    const ssdIds = [
      ...new Set(
        templates
          .filter((t) => t.scalingStatDistribution > 0)
          .map((t) => t.scalingStatDistribution),
      ),
    ];
    const ssdMap = await this.batchFetchSSD(ssdIds);

    // Fetch SSV row for this character level (needed for heirloom scaling)
    let ssvRow: ScalingStatValues | null = null;
    if (ssdIds.length > 0) {
      ssvRow = await this.ssvRepo.findOne({ where: { charlevel: level } });
    }

    // 6. Collect spell IDs from templates and batch-fetch descriptions
    const allSpellIds = new Set<number>();
    for (const t of templates) {
      const rec = t as unknown as Record<string, number>;
      for (let i = 1; i <= 5; i++) {
        const spellId = rec[`spellId${i}`] ?? 0;
        if (spellId > 0) allSpellIds.add(spellId);
      }
    }
    const spellTextMap = await this.batchFetchSpellText(
      [...allSpellIds],
      this.itemTemplateRepo.manager.connection,
    );

    // 7. Build result for all 23 slots
    const result: EquippedItemSlot[] = [];
    for (let slot = 0; slot < TOTAL_EQUIPMENT_SLOTS; slot++) {
      const itemGuid = slotToItemGuid.get(slot);
      if (itemGuid === undefined) {
        result.push({ slot, item: null });
        continue;
      }

      const instance = instanceMap.get(itemGuid);
      if (!instance) {
        result.push({ slot, item: null });
        continue;
      }

      const template = templateMap.get(instance.itemEntry);
      if (!template) {
        result.push({ slot, item: null });
        continue;
      }

      // Resolve suffix name
      let suffixName = '';
      if (instance.randomPropertyId > 0) {
        suffixName =
          randomPropsMap.get(instance.randomPropertyId)?.nameLangEnUS ?? '';
      } else if (instance.randomPropertyId < 0) {
        suffixName =
          randomSuffixMap.get(Math.abs(instance.randomPropertyId))
            ?.nameLangEnUS ?? '';
      }

      // Build base stats from template
      let stats = this.extractStats(template);

      // Add random property/suffix stats from enchantments
      if (instance.randomPropertyId !== 0) {
        const suffixStats = this.resolveRandomPropertyStats(
          instance,
          template,
          enchantmentMap,
          randomSuffixMap,
          randPropPointsMap,
        );
        if (suffixStats.length > 0) {
          stats = [...stats, ...suffixStats];
        }
      }

      let armor = template.armor;
      let dmgMin = template.dmgMin1;
      let dmgMax = template.dmgMax1;

      // Heirloom scaling: override stats if ScalingStatDistribution is set
      if (template.scalingStatDistribution > 0 && ssvRow) {
        const ssd = ssdMap.get(template.scalingStatDistribution);
        if (ssd) {
          const cappedLevel = ssd.maxlevel > 0 ? Math.min(level, ssd.maxlevel) : level;
          // Re-fetch SSV for capped level if different
          const effectiveSSV =
            cappedLevel === level
              ? ssvRow
              : await this.ssvRepo.findOne({
                  where: { charlevel: cappedLevel },
                });

          if (effectiveSSV) {
            // Resolve budget multiplier from ScalingStatValue bitmask
            const budgetMultiplier = this.resolveBudgetMultiplier(
              template.scalingStatValue,
              effectiveSSV,
            );

            if (budgetMultiplier > 0) {
              // Compute scaled stats
              const scaledStats: { type: number; value: number }[] = [];
              const ssdRec = ssd as unknown as Record<string, number>;
              for (let i = 1; i <= 10; i++) {
                const statId = ssdRec[`statId${i}`] ?? -1;
                const bonus = ssdRec[`bonus${i}`] ?? 0;
                if (statId >= 0 && bonus > 0) {
                  const value = Math.floor(
                    (budgetMultiplier * bonus) / 10000,
                  );
                  if (value > 0) {
                    scaledStats.push({ type: statId, value });
                  }
                }
              }
              if (scaledStats.length > 0) {
                stats = scaledStats;
              }
            }

            // Armor scaling
            const scaledArmor = this.resolveScaledArmor(
              template.scalingStatValue,
              effectiveSSV,
            );
            if (scaledArmor > 0) {
              armor = scaledArmor;
            }

            // DPS scaling for weapons
            if (template.class === 2 && template.delay > 0) {
              const scaledDPS = this.resolveScaledDPS(
                template.scalingStatValue,
                effectiveSSV,
              );
              if (scaledDPS > 0) {
                const avgDmg = (scaledDPS * template.delay) / 1000;
                // IsTwoHand → 0.2 spread, else 0.3 (from Player.cpp _ApplyWeaponDamage)
                const mod = this.isTwoHandDPS(template.scalingStatValue) ? 0.2 : 0.3;
                dmgMin = Math.floor((1 - mod) * avgDmg);
                dmgMax = Math.floor((1 + mod) * avgDmg);
              }
            }
          }
        }
      }

      const displayName = suffixName
        ? `${template.name} ${suffixName}`
        : template.name;

      // Resolve spell effects (Equip:/Use:/Chance on hit: lines)
      const spellEffects: { trigger: number; description: string }[] = [];
      const tmplRec = template as unknown as Record<string, number>;
      for (let i = 1; i <= 5; i++) {
        const spellId = tmplRec[`spellId${i}`] ?? 0;
        const trigger = tmplRec[`spellTrigger${i}`] ?? 0;
        if (spellId > 0) {
          const desc = spellTextMap.get(spellId);
          if (desc) {
            spellEffects.push({ trigger, description: desc });
          }
        }
      }

      result.push({
        slot,
        item: {
          entry: template.entry,
          name: displayName,
          suffixName,
          quality: template.quality,
          itemLevel: template.itemLevel,
          itemClass: template.class,
          itemSubclass: template.subclass,
          inventoryType: template.inventoryType,
          bonding: template.bonding,
          requiredLevel: template.requiredLevel,
          armor,
          stats,
          dmgMin,
          dmgMax,
          dmgType: template.dmgType1,
          speed: template.delay / 1000,
          maxDurability: template.maxDurability,
          allowableClass: template.allowableClass,
          allowableRace: template.allowableRace,
          sellPrice: template.sellPrice,
          description: template.description,
          spellEffects,
        },
      });
    }

    return result;
  }

  // Keep for backwards compat — existing batch endpoint
  async getItemTemplates(entries: number[]): Promise<ItemTooltipData[]> {
    const unique = [...new Set(entries.filter((e) => e > 0))].slice(0, 50);
    if (unique.length === 0) return [];

    const items = await this.itemTemplateRepo.find({
      where: { entry: In(unique) },
    });

    return items.map((item) => ({
      entry: item.entry,
      name: item.name,
      suffixName: '',
      quality: item.quality,
      itemLevel: item.itemLevel,
      itemClass: item.class,
      itemSubclass: item.subclass,
      inventoryType: item.inventoryType,
      bonding: item.bonding,
      requiredLevel: item.requiredLevel,
      armor: item.armor,
      stats: this.extractStats(item),
      dmgMin: item.dmgMin1,
      dmgMax: item.dmgMax1,
      dmgType: item.dmgType1,
      speed: item.delay / 1000,
      maxDurability: item.maxDurability,
      allowableClass: item.allowableClass,
      allowableRace: item.allowableRace,
      sellPrice: item.sellPrice,
      description: item.description,
      spellEffects: [],
    }));
  }

  // --- Private helpers ---

  private extractStats(item: ItemTemplate): { type: number; value: number }[] {
    const stats: { type: number; value: number }[] = [];
    const rec = item as unknown as Record<string, number>;
    for (let i = 1; i <= 10; i++) {
      const type = rec[`statType${i}`] ?? 0;
      const value = rec[`statValue${i}`] ?? 0;
      if (type !== 0 && value !== 0) {
        stats.push({ type, value });
      }
    }
    return stats;
  }

  private async batchFetchRandomProperties(
    ids: number[],
  ): Promise<Map<number, ItemRandomProperties>> {
    if (ids.length === 0) return new Map();
    try {
      const rows = await this.randomPropsRepo.find({
        where: { ID: In([...new Set(ids)]) },
      });
      return new Map(rows.map((r) => [r.ID, r]));
    } catch {
      return new Map();
    }
  }

  private async batchFetchRandomSuffixes(
    ids: number[],
  ): Promise<Map<number, ItemRandomSuffix>> {
    if (ids.length === 0) return new Map();
    try {
      const rows = await this.randomSuffixRepo.find({
        where: { ID: In([...new Set(ids)]) },
      });
      return new Map(rows.map((r) => [r.ID, r]));
    } catch {
      return new Map();
    }
  }

  private async batchFetchSSD(
    ids: number[],
  ): Promise<Map<number, ScalingStatDistribution>> {
    if (ids.length === 0) return new Map();
    try {
      const rows = await this.ssdRepo.find({
        where: { ID: In([...new Set(ids)]) },
      });
      return new Map(rows.map((r) => [r.ID, r]));
    } catch {
      return new Map();
    }
  }

  private resolveBudgetMultiplier(
    bitmask: number,
    ssv: ScalingStatValues,
  ): number {
    for (const { mask, key } of SSV_BUDGET_MAP) {
      if (bitmask & mask) {
        return ssv[key] as number;
      }
    }
    return 0;
  }

  private resolveScaledArmor(
    bitmask: number,
    ssv: ScalingStatValues,
  ): number {
    // Armor bitmask bits from DBCStructure.h getArmorMod():
    const armorMap: { mask: number; key: keyof ScalingStatValues }[] = [
      { mask: 0x00000020, key: 'clothShoulderArmor' },
      { mask: 0x00000040, key: 'leatherShoulderArmor' },
      { mask: 0x00000080, key: 'mailShoulderArmor' },
      { mask: 0x00000100, key: 'plateShoulderArmor' },
      { mask: 0x00080000, key: 'clothCloakArmor' },
      { mask: 0x00100000, key: 'clothChestArmor' },
      { mask: 0x00200000, key: 'leatherChestArmor' },
      { mask: 0x00400000, key: 'mailChestArmor' },
      { mask: 0x00800000, key: 'plateChestArmor' },
    ];
    for (const { mask, key } of armorMap) {
      if (bitmask & mask) {
        return ssv[key] as number;
      }
    }
    return 0;
  }

  private resolveScaledDPS(
    bitmask: number,
    ssv: ScalingStatValues,
  ): number {
    // DPS bitmask bits from DBCStructure.h getDPSMod():
    const dpsMap: { mask: number; key: keyof ScalingStatValues }[] = [
      { mask: 0x00000200, key: 'weaponDPS1H' },
      { mask: 0x00000400, key: 'weaponDPS2H' },
      { mask: 0x00000800, key: 'spellcasterDPS1H' },
      { mask: 0x00001000, key: 'spellcasterDPS2H' },
      { mask: 0x00002000, key: 'rangedDPS' },
      { mask: 0x00004000, key: 'wandDPS' },
    ];
    for (const { mask, key } of dpsMap) {
      if (bitmask & mask) {
        return ssv[key] as number;
      }
    }
    return 0;
  }

  /** From DBCStructure.h IsTwoHand(): bits 0x400 (2H) and 0x1000 (caster 2H) */
  private isTwoHandDPS(bitmask: number): boolean {
    return (bitmask & 0x00000400) !== 0 || (bitmask & 0x00001000) !== 0;
  }

  private async batchFetchEnchantments(
    ids: number[],
  ): Promise<Map<number, SpellItemEnchantment>> {
    if (ids.length === 0) return new Map();
    try {
      const rows = await this.enchantmentRepo.find({
        where: { ID: In(ids) },
      });
      return new Map(rows.map((r) => [r.ID, r]));
    } catch {
      return new Map();
    }
  }

  private async batchFetchRandPropPoints(
    itemLevels: number[],
  ): Promise<Map<number, RandPropPoints>> {
    if (itemLevels.length === 0) return new Map();
    try {
      const rows = await this.randPropPointsRepo.find({
        where: { ID: In(itemLevels) },
      });
      return new Map(rows.map((r) => [r.ID, r]));
    } catch {
      return new Map();
    }
  }

  private async batchFetchSpellText(
    spellIds: number[],
    ds: DataSource,
  ): Promise<Map<number, string>> {
    if (spellIds.length === 0) return new Map();
    try {
      const placeholders = spellIds.map(() => '?').join(',');
      const rows: { ID: number; Description: string }[] = await ds.query(
        `SELECT ID, Description FROM item_spell_text WHERE ID IN (${placeholders})`,
        spellIds,
      );
      return new Map(rows.map((r) => [r.ID, r.Description]));
    } catch {
      return new Map();
    }
  }

  /**
   * Parse enchantment IDs from the random property slots (7-11) in the
   * item_instance.enchantments string. Each slot = 3 values (id, duration, charges).
   * Slots 7-11 start at index 21 (7*3=21).
   */
  private parseRandomEnchantmentIds(enchantments: string | null): number[] {
    if (!enchantments) return [];
    const parts = enchantments.trim().split(/\s+/).map(Number);
    const ids: number[] = [];
    // Random property enchantments are in slots 7-11 (PROP_ENCHANTMENT_SLOT_0..4)
    for (let slot = 7; slot <= 11; slot++) {
      const idx = slot * 3; // each slot has 3 values: id, duration, charges
      const enchId = parts[idx] ?? 0;
      if (enchId > 0) ids.push(enchId);
    }
    return ids;
  }

  /**
   * Resolve stats from random property/suffix enchantments.
   * - Positive randomPropertyId: stat values come from SpellItemEnchantment.EffectPointsMin
   * - Negative randomPropertyId: stat values computed from AllocationPct * suffixFactor / 10000
   */
  private resolveRandomPropertyStats(
    instance: ItemInstance,
    template: ItemTemplate,
    enchantmentMap: Map<number, SpellItemEnchantment>,
    randomSuffixMap: Map<number, ItemRandomSuffix>,
    randPropPointsMap: Map<number, RandPropPoints>,
  ): { type: number; value: number }[] {
    const enchIds = this.parseRandomEnchantmentIds(instance.enchantments);
    if (enchIds.length === 0) return [];

    const stats: { type: number; value: number }[] = [];

    if (instance.randomPropertyId > 0) {
      // Positive: stats are baked into enchantment DBC (EffectPointsMin)
      for (const enchId of enchIds) {
        const ench = enchantmentMap.get(enchId);
        if (!ench) continue;
        for (let e = 1; e <= 3; e++) {
          const effect = (ench as unknown as Record<string, number>)[`effect${e}`] ?? 0;
          if (effect !== 5) continue; // 5 = ITEM_ENCHANTMENT_TYPE_STAT
          const statType = (ench as unknown as Record<string, number>)[`effectArg${e}`] ?? 0;
          const statValue = (ench as unknown as Record<string, number>)[`effectPointsMin${e}`] ?? 0;
          if (statType > 0 && statValue > 0) {
            stats.push({ type: statType, value: statValue });
          }
        }
      }
    } else if (instance.randomPropertyId < 0) {
      // Negative: compute from suffix AllocationPct * suffixFactor / 10000
      const suffix = randomSuffixMap.get(Math.abs(instance.randomPropertyId));
      if (!suffix) return [];

      const suffixFactor = this.getSuffixFactor(template, randPropPointsMap);
      if (suffixFactor === 0) return [];

      // Match enchantment IDs to suffix slots to get the right AllocationPct
      for (let s = 1; s <= 5; s++) {
        const suffEnchId = (suffix as unknown as Record<string, number>)[`enchantment${s}`] ?? 0;
        const allocPct = (suffix as unknown as Record<string, number>)[`allocationPct${s}`] ?? 0;
        if (suffEnchId === 0 || allocPct === 0) continue;

        const ench = enchantmentMap.get(suffEnchId);
        if (!ench) continue;

        for (let e = 1; e <= 3; e++) {
          const effect = (ench as unknown as Record<string, number>)[`effect${e}`] ?? 0;
          if (effect !== 5) continue;
          const statType = (ench as unknown as Record<string, number>)[`effectArg${e}`] ?? 0;
          if (statType > 0) {
            const value = Math.floor((suffixFactor * allocPct) / 10000);
            if (value > 0) {
              stats.push({ type: statType, value });
            }
          }
        }
      }
    }

    return stats;
  }

  /**
   * Compute the suffix factor for an item, matching AzerothCore's
   * GenerateEnchSuffixFactor logic from ItemEnchantmentMgr.cpp.
   */
  private getSuffixFactor(
    template: ItemTemplate,
    randPropPointsMap: Map<number, RandPropPoints>,
  ): number {
    const rpp = randPropPointsMap.get(template.itemLevel);
    if (!rpp) return 0;

    // InventoryType → coefficient index (0-4)
    let coeff: number;
    switch (template.inventoryType) {
      case 0:  // NON_EQUIP
      case 18: // BAG
      case 19: // TABARD
      case 24: // AMMO
      case 11: // QUIVER (INVTYPE_BAG for quivers)
      case 28: // RELIC
        return 0;
      case 1:  // HEAD
      case 4:  // BODY
      case 5:  // CHEST
      case 7:  // LEGS
      case 17: // 2HWEAPON
      case 20: // ROBE
        coeff = 0;
        break;
      case 3:  // SHOULDERS
      case 6:  // WAIST
      case 8:  // FEET
      case 10: // HANDS
      case 12: // TRINKET
        coeff = 1;
        break;
      case 2:  // NECK
      case 9:  // WRISTS
      case 11: // FINGER
      case 14: // SHIELD
      case 16: // CLOAK (INVTYPE_CLOAK = 16)
      case 23: // HOLDABLE
        coeff = 2;
        break;
      case 13: // WEAPON
      case 21: // WEAPONMAINHAND
      case 22: // WEAPONOFFHAND
        coeff = 3;
        break;
      case 15: // RANGED
      case 25: // THROWN
      case 26: // RANGEDRIGHT
        coeff = 4;
        break;
      default:
        return 0;
    }

    // Quality → column set
    const idx = coeff + 1; // columns are 1-indexed (epic1..epic5)
    const rec = rpp as unknown as Record<string, number>;
    switch (template.quality) {
      case 2: // Uncommon (Good)
        return rec[`good${idx}`] ?? 0;
      case 3: // Rare (Superior)
        return rec[`superior${idx}`] ?? 0;
      case 4: // Epic
        return rec[`epic${idx}`] ?? 0;
      default:
        return 0;
    }
  }
}
