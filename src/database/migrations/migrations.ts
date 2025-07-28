import type { Knex } from 'knex';

import { init } from './migrations-001.init.ts';
import type { Migration } from './migrations.types.ts';

const migrations = [init] satisfies Migration[];

const migrationSource: Knex.MigrationSource<Migration> = {
  getMigrations: async () => migrations,
  getMigrationName: (migration) => migration.name,
  getMigration: async (migration) => migration,
};

export { tableNames, type Table } from './migrations-001.init.ts';
export { migrationSource };
