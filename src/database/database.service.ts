import knex, { type Knex } from "knex";
import { migrationSource } from "./migrations/migrations.ts";
import { Services } from "../utils/service.ts";
import { PostgresService } from "../services/postgres/postgres.service.ts";
import { ConfigService } from "../services/config/config.ts";

const DATABASE_NAME = 'homelab';

class DatabaseService {
  #services: Services;
  #knex?: Promise<Knex>;

  constructor(services: Services) {
    this.#services = services;
  }

  #setup = async () => {
    const password = crypto.randomUUID();
    const postgresService = this.#services.get(PostgresService);
    await postgresService.upsertRole({
      name: DATABASE_NAME,
      password,
    });
    await postgresService.upsertDatabase({
      name: DATABASE_NAME,
      owner: DATABASE_NAME,
    });
    const configService = this.#services.get(ConfigService);
    const postgresConfig = configService.postgres;
    const db = knex({
      client: 'pg',
      connection: {
        host: postgresConfig.host,
        user: postgresConfig.user,
        password: postgresConfig.password,
        database: DATABASE_NAME,
      },
      migrations: {
        migrationSource,
      },
    });

    await db.migrate.latest();

    return db;
  }

  public getDb = async () => {
    if (!this.#knex) {
      this.#knex = this.#setup();
    }
    return this.#knex;
  }
}

export { tableNames, type Table } from "./migrations/migrations.ts";
export { DatabaseService };