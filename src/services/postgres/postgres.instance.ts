import knex, { type Knex } from 'knex';

import { Services } from '../../utils/service.ts';

import type { PostgresDatabase, PostgresRole } from './postgres.types.ts';

type PostgresInstanceOptions = {
  services: Services;
  host: string;
  port?: number;
  username: string;
  password: string;
  database?: string;
};

class PostgresInstance {
  #db: Knex;

  constructor(options: PostgresInstanceOptions) {
    this.#db = knex({
      client: 'pg',
      connection: {
        host: process.env.FORCE_PG_HOST ?? options.host,
        user: process.env.FORCE_PG_USER ?? options.username,
        password: process.env.FORCE_PG_PASSWORD ?? options.password,
        port: process.env.FORCE_PG_PORT ? parseInt(process.env.FORCE_PG_PORT) : options.port,
        database: options.database,
      },
    });
  }

  public ping = async () => {
    try {
      await this.#db.raw('SELECT 1');
      return true;
    } catch {
      return false;
    }
  };

  public upsertRole = async (role: PostgresRole) => {
    const existingRole = await this.#db.raw('SELECT 1 FROM pg_roles WHERE rolname = ?', [role.name]);

    if (existingRole.rows.length === 0) {
      await this.#db.raw(`CREATE ROLE ${role.name} WITH LOGIN PASSWORD '${role.password}'`);
    } else {
      await this.#db.raw(`ALTER ROLE ${role.name} WITH PASSWORD '${role.password}'`);
    }
  };

  public upsertDatabase = async (database: PostgresDatabase) => {
    const existingDatabase = await this.#db.raw('SELECT * FROM pg_database WHERE datname = ?', [database.name]);

    if (existingDatabase.rows.length === 0) {
      await this.#db.raw(`CREATE DATABASE ${database.name} OWNER ${database.owner}`);
    } else {
      await this.#db.raw(`ALTER DATABASE ${database.name} OWNER TO ${database.owner}`);
    }
  };
}

export { PostgresInstance, type PostgresInstanceOptions };
