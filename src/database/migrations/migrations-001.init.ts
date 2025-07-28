import type { Migration } from "./migrations.types.ts";

const tableNames = {
  secrets: 'secrets',
  postgresRoles: 'postgres_roles',
}

const init: Migration = {
  name: 'init',
  up: async (db) => {
    await db.schema.createTable(tableNames.secrets, (table) => {
      table.string('name').primary();
      table.string('namespace').notNullable();
      table.string('secretName').notNullable();
      table.json('template').notNullable();
      table.json('data').notNullable();
      table.primary(['name', 'namespace']);
    });

    await db.schema.createTable(tableNames.postgresRoles, (table) => {
      table.string('name').primary();
      table.string('namespace').notNullable();
      table.text('password').notNullable();
    });
  },
  down: async (db) => {
    await db.schema.dropTable(tableNames.secrets);
    await db.schema.dropTable(tableNames.postgresRoles);
  },
}

type PostgresRoleRow = {
  name: string;
  namespace: string;
  password: string;
}

type SecretRow = {
  name: string;
  namespace: string;
  secretName: string;
  template: Record<string, unknown>;
  data: Record<string, string>;
}

type Table = {
  secrets: SecretRow;
  postgresRoles: PostgresRoleRow;
}

export { init, tableNames, type PostgresRoleRow, type SecretRow, type Table };