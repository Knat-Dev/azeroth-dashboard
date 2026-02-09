# Azeroth Dashboard

You are an expert in TypeScript, React 19, Next.js 16 (App Router), NestJS 11, Tailwind CSS v4, Turborepo, TypeORM, SQLite (better-sqlite3), and Docker. You are building a server management dashboard for an AzerothCore WoTLK private server. You understand the WoW 3.3.5a data model (accounts, characters, guilds, realms, GM levels) and how AzerothCore's MySQL databases are structured.

## Architecture

```
apps/web   — Next.js 16, React 19, Tailwind v4, Highcharts (port 7790 dev / 7780 prod)
apps/api   — NestJS 11, TypeORM (MySQL for game DBs), better-sqlite3 (dashboard-local data) (port 7791 dev / 7781 prod)
packages/shared  — Pure TS types & constants (WOW_CLASSES, WOW_RACES, WOW_ZONES, GmLevel, etc.)
packages/ui      — Shared UI components
```

## Commands

```bash
pnpm dev          # Start both apps (turbo)
pnpm build        # Build all
pnpm test         # Run tests (Jest in API)
pnpm lint         # ESLint across all packages
pnpm check-types  # TypeScript type checking
```

## Timestamps — IMPORTANT

SQLite stores all timestamps via `datetime('now')` which returns UTC strings **without** a `Z` suffix (e.g. `2025-02-08 15:30:45`). JavaScript's `new Date()` interprets such strings as **local time**, causing every timestamp to appear off by the user's timezone offset.

**How this is handled:**

1. **API client reviver (primary defense):** `apps/web/src/lib/api.ts` has a `timestampReviver` in `JSON.parse` that appends `Z` to all bare datetime strings as they arrive from the API. This means all API data flowing through the `api` client has correct UTC timestamps automatically — new code using `new Date(timestamp)` on API data will just work.

2. **`parseUTC()` helper (explicit fallback):** `apps/web/src/lib/utils.ts` exports `parseUTC(timestamp)` for any case where timestamps don't flow through the API client (e.g. WebSocket messages, direct fetch, or third-party data). Use this instead of `new Date()` when parsing timestamps from any backend source.

**Rules:**
- Never use raw `new Date(someApiTimestamp)` outside of API-client-fetched data
- If adding a new data source (WebSocket, SSE, etc.), make sure timestamps are normalized to include `Z` or use `parseUTC()`
- SQLite queries comparing against `datetime('now')` are correct since both sides are UTC

## Auth

JWT-based via NestJS Passport. `JWT_SECRET` from env. Auth response returns `{ accessToken, user: { id, username, email, gmLevel } }`. GmLevel enum: 0=Player, 1=Moderator, 2=GameMaster, 3=Admin, 4=Console.

## Docker

The API container mounts `/var/run/docker.sock` to manage AzerothCore containers (restart worldserver/authserver). Connects to external `ac-network`. Volumes: `dashboard-data` (SQLite), `dashboard-backups`.

## Databases

- **MySQL** (via TypeORM): AzerothCore's `acore_auth`, `acore_characters`, `acore_world` — read-only for dashboard queries (accounts, characters, guilds, bans). Only `ItemTemplate` is registered from `acore_world`; no writes to any game DB.
- **SQLite** (via better-sqlite3): Two database files:
  - `dashboard.db` — mutable operational data (events, player_history, settings, container_stats)
  - `dbc.db` — immutable DBC reference data (item random properties/suffixes, enchantments, scaling stats, spell texts). Auto-seeded from `apps/api/seeds/*.sql` on first run. Can be safely deleted and regenerated.
  - Path: `/data/` (prod) or `./data/` (dev)

## Item Tooltips & Equipment System

Equipment data flows through `GET /server/players/:guid/equipment?level=N`:

1. **Query chain:** `character_inventory` (bag=0) → `item_instance` → `item_template` (world DB)
2. **Character inventory is only saved to MySQL on character logout or periodic server save.** While a player is online, equipment changes are in the worldserver's memory and won't appear in the dashboard until the next save/logout.

### Random Suffixes (e.g. "Brigade Circlet of the Falcon")
- `item_instance.randomPropertyId` determines the suffix:
  - **Positive** → `itemrandomproperties_dbc` for suffix name; stat values baked into `spellitemenchantment_dbc.EffectPointsMin`
  - **Negative** → `itemrandomsuffix_dbc` for suffix name + `AllocationPct`; stat values computed as `floor(suffixFactor * AllocationPct / 10000)`
- Suffix factor from `randproppoints_dbc` indexed by ItemLevel, mapped by InventoryType→coefficient(0-4) and Quality→column set (Good/Superior/Epic)
- Enchantment IDs parsed from `item_instance.enchantments` field (space-separated triplets; random property slots are 7-11, starting at index 21)
- Stat type from `spellitemenchantment_dbc`: Effect type 5 = ITEM_ENCHANTMENT_TYPE_STAT, EffectArg = stat type

### Heirloom Scaling (quality 7 items)
- `item_template.ScalingStatDistribution` → `scalingstatdistribution_dbc` (stat types + bonus multipliers)
- `item_template.ScalingStatValue` bitmask → selects budget/DPS/armor columns from `scalingstatvalues_dbc` at the character's level
- **Bitmask mappings** (from AzerothCore `DBCStructure.h`):
  - Budget: `0x001`=Shoulder, `0x002`=Trinket, `0x004`=Weapon1H, `0x008`=Primary, `0x010`=Ranged, `0x40000`=Tertiary
  - DPS: `0x200`=1H, `0x400`=2H, `0x800`=Caster1H, `0x1000`=Caster2H, `0x2000`=Ranged, `0x4000`=Wand
  - Armor shoulder: `0x020`=Cloth, `0x040`=Leather, `0x080`=Mail, `0x100`=Plate
  - Armor chest: `0x100000`=Cloth, `0x200000`=Leather, `0x400000`=Mail, `0x800000`=Plate; `0x80000`=Cloak
- Weapon damage: `DPS * delay / 1000` with spread factor 0.2 (2H) or 0.3 (1H) from `IsTwoHand()`

### Spell Effects (e.g. "Equip: +10% XP")
- `item_template.spellid_1..5` + `spelltrigger_1..5` (trigger 0=Use, 1=Equip, 2=Chance on hit)
- Descriptions from `item_spell_text` table (custom, seeded from Spell.dbc — field 170 = Description_Lang_enUS)
- `$s1`/`$s2`/`$s3` placeholders resolved at seed time using `EffectBasePoints + 1`

### DBC Seed Data
`DbcStore` service (OnModuleInit) manages a dedicated `dbc.db` SQLite file with 7 tables, auto-seeded from `apps/api/seeds/*.sql`:
- `item_random_properties`, `item_random_suffix`, `scaling_stat_distribution`, `scaling_stat_values`, `spell_item_enchantment`, `rand_prop_points`, `item_spell_text`
- All DBC data is stored in the dashboard's own SQLite — no writes to AzerothCore's MySQL databases
- `DbcStore` exposes typed synchronous lookup methods (using better-sqlite3 prepared statements) consumed by `ServerService`

**How the seeds were created:**

AzerothCore creates `*_dbc` table structures in MySQL but leaves them empty. The actual data lives in binary DBC files inside the worldserver container at `/azerothcore/env/dist/data/dbc/`.

1. **Copy DBC from container:** `docker cp ac-worldserver:/azerothcore/env/dist/data/dbc/ItemRandomProperties.dbc /tmp/`
2. **Parse the WDBC binary format:** All DBC files share the same header structure:
   - Bytes 0-3: `WDBC` magic
   - Bytes 4-7: recordCount (uint32 LE)
   - Bytes 8-11: fieldCount (uint32 LE)
   - Bytes 12-15: recordSize (uint32 LE)
   - Bytes 16-19: stringBlockSize (uint32 LE)
   - Then `recordCount` records of `recordSize` bytes each
   - Then the string block (string fields store an offset into this block)
3. **Determine field indices:** Use `SHOW COLUMNS FROM <table>` on the MySQL table — the column order matches the DBC field order. Column N in the listing = field index N-1 (0-indexed). Each field is 4 bytes (uint32 for ints, offset for strings).
4. **Write a Node.js parser script** (run with `node /tmp/parse-xxx.mjs`) that reads the binary, extracts the fields we need, and generates SQL INSERT statements.
5. **Save the SQL** to `apps/api/seeds/<name>.sql`

For `Spell.dbc` specifically (49k records, 234 fields, 48MB):
- Only extracted descriptions for the ~1251 equip spells used in `item_template` (not all 49k)
- Resolved `$s1`/`$s2`/`$s3` placeholders using `EffectBasePoints` fields at parse time
- Stored in a custom `item_spell_text` table (CREATE TABLE in the seed SQL itself)

**Reference sources for formulas and bitmasks:**
- AzerothCore C++ source at `../src/server/` (one directory up from dashboard)
- Key files: `src/server/shared/DataStores/DBCStructure.h` (bitmask methods), `src/server/game/Entities/Player/Player.cpp` (`_ApplyWeaponDamage`), `src/server/game/Entities/Item/ItemEnchantmentMgr.cpp` (`GenerateEnchSuffixFactor`)
- MySQL DB for verifying column names and data: `docker exec ac-database mysql -uroot -p123123 -e "DESCRIBE <table>;" acore_world`

**To regenerate seeds** (e.g. after AzerothCore update):
1. `docker cp ac-worldserver:/azerothcore/env/dist/data/dbc/<File>.dbc /tmp/`
2. Run the appropriate parser script (saved in /tmp/ during development, not checked in)
3. Copy output SQL to `apps/api/seeds/`

### Tooltip Rendering
- **White stats** (primary: Agi/Str/Int/Spi/Sta) → `+X StatName` after armor
- **Green equip lines** (ratings, AP, SP, etc.) → `Equip: Increases X by Y.` after durability/required level
- **Green spell effects** → `Equip:/Use:/Chance on hit:` lines after equip stats
- Constants: `PRIMARY_STAT_TYPES`, `EQUIP_STAT_TEXT` in `packages/shared/src/constants/`

## Shared Package

`@repo/shared` is the cross-app type contract. When adding new API endpoints, define request/response types here first. No runtime dependencies — pure TypeScript compiled to `dist/`.
