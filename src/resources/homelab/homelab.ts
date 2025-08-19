import { Environment } from './environment/environment.ts';
import { PostgresCluster } from './postgres-cluster/postgres-cluster.ts';
import { RedisServer } from './redis-server/redis-server.ts';
import { PostgresDatabase } from './postgres-database/postgres-database.ts';
import { AuthentikServer } from './authentik-server/authentik-server.ts';

import type { InstallableResourceClass } from '#services/resources/resources.ts';

const homelab = {
  PostgresCluster,
  RedisServer,
  Environment,
  AuthentikServer,
  PostgresDatabase,
} satisfies Record<string, InstallableResourceClass<ExpectedAny>>;

export { homelab };
