import knex, { type Knex } from 'knex';

import { Services } from '../../utils/service.ts';

import type { PostgresDatabase, PostgresRole } from './postgres.types.ts';

type PostgresInstanceOptions = {
  services: Services;
  host: string;
  port?: number;
  user: string;
  password: string;
  database?: string;
};

class PostgresInstance {
  #db: Knex;

  constructor(options: PostgresInstanceOptions) {
    this.#db = knex({
      client: 'pg',
      connection: {
        host: options.host,
        user: options.user,
        password: options.password,
        port: options.port,
        database: options.database,
      },
    });
  }

  public ping = async () => {
    try {
      await this.#db.raw('SELECT 1');
      return;
    } catch (err) {
      return err;
    }
  };

  public upsertRole = async (role: PostgresRole) => {
    const name = role.name;
    const existingRole = await this.#db.raw('SELECT 1 FROM pg_roles WHERE rolname = ?', [name]);

    if (existingRole.rows.length === 0) {
      await this.#db.raw(`CREATE ROLE "${name}" WITH LOGIN PASSWORD '${role.password}'`);
    } else {
      await this.#db.raw(`ALTER ROLE "${name}" WITH PASSWORD '${role.password}'`);
    }
  };

  public upsertDatabase = async (database: PostgresDatabase) => {
    const owner = database.owner;
    const name = database.name;
    const existingDatabase = await this.#db.raw('SELECT * FROM pg_database WHERE datname = ?', [name]);

    if (existingDatabase.rows.length === 0) {
      await this.#db.raw(`CREATE DATABASE "${name}" OWNER "${owner}"`);
    } else {
      await this.#db.raw(`ALTER DATABASE "${name}" OWNER TO "${owner}"`);
    }
  };

  public close = async () => {
    await this.#db.destroy();
  };
}

export { PostgresInstance, type PostgresInstanceOptions };
