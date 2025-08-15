import type { V1Secret } from '@kubernetes/client-node';

import {
  CustomResource,
  type CustomResourceOptions,
  type SubresourceResult,
} from '../../services/custom-resources/custom-resources.custom-resource.ts';
import { PostgresService } from '../../services/postgres/postgres.service.ts';
import { ResourceReference } from '../../services/resources/resources.ref.ts';
import { ResourceService } from '../../services/resources/resources.ts';
import { getWithNamespace } from '../../utils/naming.ts';
import { decodeSecret } from '../../utils/secrets.ts';
import { postgresClusterSecretSchema } from '../postgres-cluster/postgres-cluster.schemas.ts';
import { SecretInstance } from '../../instances/secret.ts';

import { type postgresDatabaseSpecSchema } from './portgres-database.schemas.ts';

const SECRET_READY_CONDITION = 'Secret';
const DATABASE_READY_CONDITION = 'Database';

class PostgresDatabaseResource extends CustomResource<typeof postgresDatabaseSpecSchema> {
  #clusterSecret: ResourceReference<V1Secret>;
  #databaseSecret: SecretInstance<typeof postgresClusterSecretSchema>;

  constructor(options: CustomResourceOptions<typeof postgresDatabaseSpecSchema>) {
    super(options);
    const resourceService = this.services.get(ResourceService);

    this.#clusterSecret = new ResourceReference();

    this.#databaseSecret = resourceService.getInstance(
      {
        apiVersion: 'v1',
        kind: 'Secret',
        name: `${this.name}-postgres-database`,
        namespace: this.namespace,
      },
      SecretInstance<typeof postgresClusterSecretSchema>,
    );

    this.#updateSecret();
    this.#clusterSecret.on('changed', this.queueReconcile);
    this.#databaseSecret.on('changed', this.queueReconcile);
  }

  get #dbName() {
    return `${this.namespace}_${this.name}`;
  }

  get #userName() {
    return `${this.namespace}_${this.name}`;
  }

  #updateSecret = () => {
    const resourceService = this.services.get(ResourceService);
    const secretNames = getWithNamespace(this.spec.cluster, this.namespace);
    this.#clusterSecret.current = resourceService.get({
      apiVersion: 'v1',
      kind: 'Secret',
      name: secretNames.name,
      namespace: secretNames.namespace,
    });
  };

  #reconcileSecret = async (): Promise<SubresourceResult> => {
    const serverSecret = this.#clusterSecret.current;
    const databaseSecret = this.#databaseSecret;

    if (!serverSecret?.exists || !serverSecret.data) {
      return {
        ready: false,
        failed: true,
        reason: 'MissingConnectionSecret',
      };
    }
    const serverSecretData = postgresClusterSecretSchema.safeParse(decodeSecret(serverSecret.data));
    if (!serverSecretData.success || !serverSecretData.data) {
      return {
        ready: false,
        syncing: true,
        reason: 'SecretMissing',
      };
    }
    const databaseSecretData = postgresClusterSecretSchema.safeParse(decodeSecret(databaseSecret.data));
    const expectedSecret = {
      password: crypto.randomUUID(),
      host: serverSecretData.data.host,
      port: serverSecretData.data.port,
      username: this.#userName,
      database: this.#dbName,
      ...databaseSecretData.data,
    };

    await databaseSecret.ensureData(expectedSecret);

    return {
      ready: true,
    };
  };

  #reconcileDatabase = async (): Promise<SubresourceResult> => {
    const clusterSecret = this.#clusterSecret.current;
    if (!clusterSecret?.exists || !clusterSecret.data) {
      return {
        ready: false,
        failed: true,
        reason: 'MissingConnectionSecret',
      };
    }

    const connectionSecretData = postgresClusterSecretSchema.safeParse(decodeSecret(clusterSecret.data));
    if (!connectionSecretData.success || !connectionSecretData.data) {
      return {
        ready: false,
        syncing: true,
        reason: 'SecretMissing',
      };
    }

    const secretData = postgresClusterSecretSchema.safeParse(decodeSecret(this.#databaseSecret.data));
    if (!secretData.success || !secretData.data) {
      return {
        ready: false,
        syncing: true,
        reason: 'ConnectionSecretMissing',
      };
    }

    const postgresService = this.services.get(PostgresService);
    const database = postgresService.get({
      ...connectionSecretData.data,
      port: connectionSecretData.data.port ? Number(connectionSecretData.data.port) : 5432,
      database: connectionSecretData.data.database,
    });
    await database.upsertRole({
      name: secretData.data.username,
      password: secretData.data.password,
    });
    await database.upsertDatabase({
      name: secretData.data.database,
      owner: secretData.data.username,
    });

    return {
      ready: true,
    };
  };

  public reconcile = async () => {
    if (!this.exists || this.metadata?.deletionTimestamp) {
      return;
    }
    this.#updateSecret();
    await Promise.allSettled([
      this.reconcileSubresource(DATABASE_READY_CONDITION, this.#reconcileDatabase),
      this.reconcileSubresource(SECRET_READY_CONDITION, this.#reconcileSecret),
    ]);

    const secretReady = this.conditions.get(SECRET_READY_CONDITION)?.status === 'True';
    const databaseReady = this.conditions.get(DATABASE_READY_CONDITION)?.status === 'True';
    await this.conditions.set('Ready', {
      status: secretReady && databaseReady ? 'True' : 'False',
    });
  };
}

export { PostgresDatabaseResource };
