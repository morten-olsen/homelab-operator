import { authentikClientDefinition } from './authentik-client/authentik-client.ts';
import { authentikConnectionDefinition } from './authentik-connection/authentik-connection.ts';
import { generateSecretDefinition } from './generate-secret/generate-secret.ts';
import { postgresDatabaseDefinition } from './postgres-database/postgres-database.ts';

const customResources = [
  postgresDatabaseDefinition,
  authentikClientDefinition,
  generateSecretDefinition,
  authentikConnectionDefinition,
];

export { customResources };
