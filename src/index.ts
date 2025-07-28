import { CustomResourceRegistry } from './custom-resource/custom-resource.registry.ts';
import { Services } from './utils/service.ts';
import { SecretRequest } from './crds/secrets/secrets.request.ts';
import { PostgresDatabase } from './crds/postgres/postgres.database.ts';

const services = new Services();
const registry = services.get(CustomResourceRegistry);
registry.register(new SecretRequest());
registry.register(new PostgresDatabase());
await registry.install(true);
await registry.watch();