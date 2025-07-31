import 'dotenv/config';
import { ApiException } from '@kubernetes/client-node';

import { CustomResourceRegistry } from './custom-resource/custom-resource.registry.ts';
import { Services } from './utils/service.ts';
import { SecretRequest } from './crds/secrets/secrets.request.ts';
import { PostgresDatabase } from './crds/postgres/postgres.database.ts';
import { AuthentikService } from './services/authentik/authentik.service.ts';
import { AuthentikClient } from './crds/authentik/client/client.ts';

const services = new Services();
const registry = services.get(CustomResourceRegistry);
registry.register(new SecretRequest());
registry.register(new PostgresDatabase());
registry.register(new AuthentikClient());
await registry.install(true);
await registry.watch();

const authentikService = services.get(AuthentikService);
await authentikService.upsertClient({
  name: 'foo',
  secret: 'foo',
  redirectUris: [{ url: 'http://localhost:3000/api/auth/callback', matchingMode: 'strict' }],
});

process.on('uncaughtException', (error) => {
  console.log('UNCAUGHT EXCEPTION');
  if (error instanceof ApiException) {
    return console.error(error.body);
  }
  console.error(error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.log('UNHANDLED REJECTION');
  if (error instanceof Error) {
    // show stack trace
    console.error(error.stack);
  }
  if (error instanceof ApiException) {
    return console.error(error.body);
  }
  console.error(error);
  process.exit(1);
});
