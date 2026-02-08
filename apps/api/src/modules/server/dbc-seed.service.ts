import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { ItemRandomProperties } from '../../entities/world/item-random-properties.entity.js';

const SEED_FILES = [
  { table: 'itemrandomproperties_dbc', file: 'itemrandomproperties.sql' },
  { table: 'itemrandomsuffix_dbc', file: 'itemrandomsuffix.sql' },
  { table: 'scalingstatdistribution_dbc', file: 'scalingstatdistribution.sql' },
  { table: 'scalingstatvalues_dbc', file: 'scalingstatvalues.sql' },
  { table: 'spellitemenchantment_dbc', file: 'spellitemenchantment.sql' },
  { table: 'randproppoints_dbc', file: 'randproppoints.sql' },
];

@Injectable()
export class DbcSeedService implements OnModuleInit {
  private readonly logger = new Logger(DbcSeedService.name);

  constructor(
    @InjectRepository(ItemRandomProperties, 'world')
    private readonly probe: Repository<ItemRandomProperties>,
  ) {}

  async onModuleInit() {
    this.logger.log('Checking DBC seed data...');
    const ds: DataSource = this.probe.manager.connection;

    for (const { table, file } of SEED_FILES) {
      try {
        const [row] = await ds.query(
          `SELECT COUNT(*) as cnt FROM \`${table}\``,
        );
        const count = parseInt(row?.cnt ?? '0', 10);
        if (count > 0) {
          this.logger.log(`${table}: ${count} rows (already seeded)`);
          continue;
        }

        const seedPath = this.resolveSeedPath(file);
        if (!seedPath) {
          this.logger.warn(
            `Seed file not found for ${table} (cwd: ${process.cwd()}), skipping`,
          );
          continue;
        }

        const sql = readFileSync(seedPath, 'utf8');
        await ds.query(sql);
        this.logger.log(`Seeded ${table} from ${seedPath}`);
      } catch (err) {
        this.logger.error(
          `Failed to seed ${table}: ${(err as Error).message}`,
        );
      }
    }
  }

  private resolveSeedPath(file: string): string | null {
    const candidates = [
      // Dev: seeds/ at project root (apps/api/seeds/)
      join(process.cwd(), 'seeds', file),
      // Production: dist/seeds/
      join(process.cwd(), 'dist', 'seeds', file),
    ];

    for (const p of candidates) {
      if (existsSync(p)) return p;
    }
    return null;
  }
}
