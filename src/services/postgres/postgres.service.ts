import knex, { type Knex } from 'knex';

import { Services } from '../../utils/service.ts';
import { ConfigService } from '../config/config.ts';

import type { PostgresDatabase, PostgresRole } from './postgres.types.ts';

class PostgresService {
  #db: Knex;
  #services: Services;

  constructor(services: Services) {
    this.#services = services;
    const configService = services.get(ConfigService);
    const config = configService.postgres;
    this.#db = knex({
      client: 'pg',
      connection: {
        host: config.host,
        user: config.user,
        password: config.password,
        port: config.port,
      },
    });
  }

  public get config() {
    const configService = this.#services.get(ConfigService);
    return configService.postgres;
  }

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

export { PostgresService };
