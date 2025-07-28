import type { Knex } from "knex";

type Migration = {
  name: string;
  up: (db: Knex) => Promise<void>;
  down: (db: Knex) => Promise<void>;
}

export type { Migration };