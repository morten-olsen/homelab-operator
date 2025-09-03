import { Environment } from './environment/environment.ts';
import { PostgresCluster } from './postgres-cluster/postgres-cluster.ts';
import { RedisServer } from './redis-server/redis-server.ts';
import { PostgresDatabase } from './postgres-database/postgres-database.ts';
import { AuthentikServer } from './authentik-server/authentik-server.ts';

import type { InstallableResourceClass } from '#services/resources/resources.ts';
import { OIDCClient } from './oidc-client/oidc-client.ts';
import { HttpService } from './http-service/http-service.ts';
import { GenerateSecret } from './generate-secret/generate-secret.ts';
import { ExternalHttpService } from './external-http-service.ts/external-http-service.ts';
import { CloudflareTunnel } from './cloudflare-tunnel/cloudflare-tunnel.ts';

const homelab = {
  PostgresCluster,
  RedisServer,
  Environment,
  ExternalHttpService,
  CloudflareTunnel,
  AuthentikServer,
  PostgresDatabase,
  OIDCClient,
  HttpService,
  GenerateSecret,
} satisfies Record<string, InstallableResourceClass<ExpectedAny>>;

export { homelab };
