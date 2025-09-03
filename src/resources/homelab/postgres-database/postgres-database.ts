import { z } from 'zod';

import { PostgresCluster } from '../postgres-cluster/postgres-cluster.ts';

import {
  CustomResource,
  ResourceReference,
  ResourceService,
  type CustomResourceOptions,
} from '#services/resources/resources.ts';
import { Secret } from '#resources/core/secret/secret.ts';
import { API_VERSION } from '#utils/consts.ts';
import { getWithNamespace } from '#utils/naming.ts';
import { PostgresService } from '#services/postgres/postgres.service.ts';
import { NotReadyError } from '#utils/errors.ts';
import { generateRandomHexPass } from '#utils/secrets.ts';

const specSchema = z.object({
  environment: z.string().optional(),
  cluster: z.string().optional(),
});

type SecretData = {
  password: string;
  user: string;
  database: string;
  host: string;
  port: string;
};

const sanitizeName = (input: string) => {
  return input.replace(/[^a-zA-Z0-9_]+/g, '_').toLowerCase();
};

class PostgresDatabase extends CustomResource<typeof specSchema> {
  public static readonly apiVersion = API_VERSION;
  public static readonly kind = 'PostgresDatabase';
  public static readonly spec = specSchema;
  public static readonly scope = 'Namespaced';

  #cluster: ResourceReference<typeof PostgresCluster>;
  #secret: Secret<SecretData>;

  constructor(options: CustomResourceOptions<typeof specSchema>) {
    super(options);
    const resourceService = this.services.get(ResourceService);

    this.#cluster = new ResourceReference();
    this.#cluster.on('changed', this.queueReconcile);

    this.#secret = resourceService.get(Secret<SecretData>, `${this.name}-pg-connection`, this.namespace);
    this.#secret.on('changed', this.queueReconcile);
  }

  public get username() {
    return sanitizeName(`${this.namespace}_${this.name}`);
  }

  public get database() {
    return sanitizeName(`${this.namespace}_${this.name}`);
  }

  public get cluster() {
    return this.#cluster;
  }

  public get secret() {
    return this.#secret;
  }

  public reconcile = async () => {
    const resourceService = this.services.get(ResourceService);
    if (this.spec?.cluster) {
      const clusterNames = getWithNamespace(this.spec.cluster, this.namespace);
      this.#cluster.current = resourceService.get(PostgresCluster, clusterNames.name, clusterNames.namespace);
    } else if (this.spec?.environment) {
      const { Environment } = await import('../environment/environment.ts');
      const environment = resourceService.get(Environment, this.spec.environment);
      this.#cluster.current = environment.postgresCluster;
    } else {
      this.#cluster.current = undefined;
      throw new NotReadyError('MissingEnvOrClusterSpec');
    }

    const clusterSecret = this.#cluster.current.secret.value;
    if (!clusterSecret) {
      throw new NotReadyError('MissingClusterSecret');
    }

    await this.#secret.set(
      (current) => ({
        password: generateRandomHexPass(),
        user: this.username,
        database: this.database,
        ...current,
        host: clusterSecret.host,
        port: clusterSecret.port,
      }),
      {
        metadata: {
          ownerReferences: [this.ref],
        },
      },
    );

    const secret = this.#secret.value;
    if (!secret) {
      throw new NotReadyError('MissingSecret');
    }

    const postgresService = this.services.get(PostgresService);
    const database = postgresService.get({
      host: clusterSecret.host,
      port: clusterSecret.port ? Number(clusterSecret.port) : 5432,
      database: clusterSecret.database,
      user: clusterSecret.user,
      password: clusterSecret.password,
    });
    const connectionError = await database.ping();
    if (connectionError) {
      console.error('Failed to connect', connectionError);
      throw new NotReadyError('FailedToConnectToDatabase');
    }
    await database.upsertRole({
      name: secret.user,
      password: secret.password,
    });
    await database.upsertDatabase({
      name: secret.database,
      owner: secret.user,
    });
  };
}

export { PostgresDatabase };
