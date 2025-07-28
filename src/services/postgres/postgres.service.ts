import knex, { type Knex } from "knex";
import type { PostgresDatabase, PostgresRole } from "./postgres.types.ts";
import { Services } from "../../utils/service.ts";
import { ConfigService } from "../config/config.ts";

class PostgresService {
  #db: Knex;

  constructor(services: Services) {
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

  public upsertRole = async (role: PostgresRole) => {
    const existingRole = await this.#db.raw(
      'SELECT 1 FROM pg_roles WHERE rolname = ?',
      [role.name]
    );

    if (existingRole.rows.length === 0) {
      await this.#db.raw(
        `CREATE ROLE ${role.name} WITH LOGIN PASSWORD '${role.password}'`,
      );
    } else {
      await this.#db.raw(
        `ALTER ROLE ${role.name} WITH PASSWORD '${role.password}'`,
      );
    }
  }

  public upsertDatabase = async (database: PostgresDatabase) => {
    const existingDatabase = await this.#db.raw(
      'SELECT * FROM pg_database WHERE datname = ?',
      [database.name]
    );


    if (existingDatabase.rows.length === 0) {
      await this.#db.raw(
        `CREATE DATABASE ${database.name} OWNER ${database.owner}`,
      );
    } else {
      await this.#db.raw(
        `ALTER DATABASE ${database.name} OWNER TO ${database.owner}`,
      );
    }
  }
}

export { PostgresService };