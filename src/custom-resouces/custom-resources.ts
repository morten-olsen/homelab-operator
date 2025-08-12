import { authentikClientDefinition } from './authentik-client/authentik-client.ts';
import { authentikServerDefinition } from './authentik-server/authentik-server.ts';
import { environmentDefinition } from './environment/environment.ts';
import { generateSecretDefinition } from './generate-secret/generate-secret.ts';
import { httpServiceDefinition } from './http-service/http-service.ts';
import { postgresClusterDefinition } from './postgres-cluster/postgres-cluster.ts';
import { postgresDatabaseDefinition } from './postgres-database/postgres-database.ts';
import { redisServerDefinition } from './redis-server/redis-server.ts';

const customResources = [
  postgresDatabaseDefinition,
  authentikClientDefinition,
  generateSecretDefinition,
  environmentDefinition,
  postgresClusterDefinition,
  authentikServerDefinition,
  httpServiceDefinition,
  redisServerDefinition,
];

export { customResources };
