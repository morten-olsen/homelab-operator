import { authentikClientDefinition } from './authentik-client/authentik-client.ts';
import { generateSecretDefinition } from './generate-secret/generate-secret.ts';
import { postgresDatabaseDefinition } from './postgres-database/postgres-database.ts';

const customResources = [postgresDatabaseDefinition, authentikClientDefinition, generateSecretDefinition];

export { customResources };
