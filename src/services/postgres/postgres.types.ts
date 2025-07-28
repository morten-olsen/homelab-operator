type PostgresRole = {
  name: string;
  password: string;
};

type PostgresDatabase = {
  name: string;
  owner: string;
};

export type { PostgresRole, PostgresDatabase };
