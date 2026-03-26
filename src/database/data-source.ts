import 'reflect-metadata';
import { join } from 'path';
import { DataSource } from 'typeorm';

function readNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  return fallback;
}

const entitiesPath = join(__dirname, '..', '**', '*.entity{.ts,.js}').replace(
  /\\/g,
  '/',
);
const migrationsPath = join(__dirname, 'migrations', '*{.ts,.js}').replace(
  /\\/g,
  '/',
);

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: readNumber(process.env.DB_PORT, 5432),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '1234',
  database: process.env.DB_DATABASE ?? 'navegaja',
  entities: [entitiesPath],
  migrations: [migrationsPath],
  synchronize: readBoolean(process.env.DB_SYNCHRONIZE, false),
  migrationsRun: readBoolean(process.env.DB_MIGRATIONS_RUN, false),
  logging: false,
  extra: {
    client_encoding: 'UTF8',
  },
});

export default dataSource;
