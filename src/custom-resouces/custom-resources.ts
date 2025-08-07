import { authentikServerDefinition } from './authentik-server/authentik-server.ts';
import { authentikClientDefinition } from './authentik-client/authentik-client.ts';
import { domainServiceDefinition } from './domain-service/domain-service.ts';
import { domainDefinition } from './domain/domain.ts';
import { postgresConnectionDefinition } from './postgres-connection/postgres-connection.ts';
import { postgresDatabaseDefinition } from './postgres-database/postgres-database.ts';
import { redisConnectionDefinition } from './redis-connection/redis-connection.ts';
import { homelabDefinition } from './homelab/homelab.ts';
import { postgresClusterDefinition } from './postgres-cluster/postgres-cluster.ts';
import { redisServerDefinition } from './redis-server/redis-server.ts';

const customResources = [
  homelabDefinition,
  domainDefinition,
  domainServiceDefinition,
  postgresClusterDefinition,
  postgresConnectionDefinition,
  postgresDatabaseDefinition,
  redisServerDefinition,
  redisConnectionDefinition,
  authentikServerDefinition,
  authentikClientDefinition,
];

export { customResources };
