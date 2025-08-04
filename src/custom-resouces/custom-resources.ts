import { authentikServerDefinition } from './authentik-server/authentik-server.ts';
import { domainServiceDefinition } from './domain-service/domain-service.ts';
import { domainDefinition } from './domain/domain.ts';
import { postgresConnectionDefinition } from './postgres-connection/postgres-connection.ts';
import { postgresDatabaseDefinition } from './postgres-database/postgres-database.ts';
import { redisConnectionDefinition } from './redis-connection/redis-connection.ts';

const customResources = [
  domainDefinition,
  domainServiceDefinition,
  postgresConnectionDefinition,
  postgresDatabaseDefinition,
  redisConnectionDefinition,
  authentikServerDefinition,
];

export { customResources };
