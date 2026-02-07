import { TypeOrmModuleOptions } from '@nestjs/typeorm';

const baseConfig = {
  type: 'mysql' as const,
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '3306', 10),
  username: 'root',
  password: process.env.DB_ROOT_PASSWORD ?? 'password',
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
};

export const authDatabaseConfig: TypeOrmModuleOptions = {
  ...baseConfig,
  name: 'auth',
  database: 'acore_auth',
};

export const charactersDatabaseConfig: TypeOrmModuleOptions = {
  ...baseConfig,
  name: 'characters',
  database: 'acore_characters',
};

export const worldDatabaseConfig: TypeOrmModuleOptions = {
  ...baseConfig,
  name: 'world',
  database: 'acore_world',
};
