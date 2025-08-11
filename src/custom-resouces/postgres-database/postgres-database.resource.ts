import { z } from 'zod';
import type { V1Secret } from '@kubernetes/client-node';

import {
  CustomResource,
  type CustomResourceOptions,
  type SubresourceResult,
} from '../../services/custom-resources/custom-resources.custom-resource.ts';
import { PostgresService } from '../../services/postgres/postgres.service.ts';
import { ResourceReference } from '../../services/resources/resources.ref.ts';
import { Resource, ResourceService } from '../../services/resources/resources.ts';
import { getWithNamespace } from '../../utils/naming.ts';
import { decodeSecret, encodeSecret } from '../../utils/secrets.ts';
import { isDeepSubset } from '../../utils/objects.ts';

import {
  postgresDatabaseConnectionSecretSchema,
  postgresDatabaseSecretSchema,
  type postgresDatabaseSpecSchema,
} from './portgres-database.schemas.ts';

const SECRET_READY_CONDITION = 'Secret';
const DATABASE_READY_CONDITION = 'Database';

const secretDataSchema = z.object({
  host: z.string(),
  port: z.string().optional(),
  database: z.string(),
  user: z.string(),
  password: z.string(),
});

class PostgresDatabaseResource extends CustomResource<typeof postgresDatabaseSpecSchema> {
  #serverSecret: ResourceReference<V1Secret>;
  #databaseSecret: Resource<V1Secret>;

  constructor(options: CustomResourceOptions<typeof postgresDatabaseSpecSchema>) {
    super(options);
    this.#serverSecret = new ResourceReference();

    const resourceService = this.services.get(ResourceService);
    this.#databaseSecret = resourceService.get({
      apiVersion: 'v1',
      kind: 'Secret',
      name: `${this.name}-connection`,
      namespace: this.namespace,
    });

    this.#updateSecret();
    this.#serverSecret.on('changed', this.queueReconcile);
  }

  get #dbName() {
    return `${this.namespace}_${this.name}`;
  }

  get #userName() {
    return `${this.namespace}_${this.name}`;
  }

  #updateSecret = () => {
    const resourceService = this.services.get(ResourceService);
    const secretNames = getWithNamespace(this.spec.secretRef, this.namespace);
    this.#serverSecret.current = resourceService.get({
      apiVersion: 'v1',
      kind: 'Secret',
      name: secretNames.name,
      namespace: secretNames.namespace,
    });
  };

  #reconcileSecret = async (): Promise<SubresourceResult> => {
    const serverSecret = this.#serverSecret.current;
    const databaseSecret = this.#databaseSecret;

    if (!serverSecret?.exists || !serverSecret.data) {
      return {
        ready: false,
        failed: true,
        reason: 'MissingConnectionSecret',
      };
    }
    const serverSecretData = postgresDatabaseSecretSchema.safeParse(decodeSecret(serverSecret.data));
    if (!serverSecretData.success || !serverSecretData.data) {
      return {
        ready: false,
        syncing: true,
        reason: 'SecretMissing',
      };
    }
    const databaseSecretData = postgresDatabaseConnectionSecretSchema.safeParse(decodeSecret(databaseSecret.data));
    const expectedSecret = {
      password: crypto.randomUUID(),
      host: serverSecretData.data.host,
      port: serverSecretData.data.port,
      user: this.#userName,
      database: this.#dbName,
      ...databaseSecretData.data,
    };

    if (!isDeepSubset(databaseSecretData.data, expectedSecret)) {
      databaseSecret.patch({
        data: encodeSecret(expectedSecret),
      });
      return {
        ready: false,
        syncing: true,
        reason: 'SecretNotReady',
      };
    }

    return {
      ready: true,
    };
  };

  #reconcileDatabase = async (): Promise<SubresourceResult> => {
    const connectionSecret = this.#serverSecret.current;
    if (!connectionSecret?.exists || !connectionSecret.data) {
      return {
        ready: false,
        failed: true,
        reason: 'MissingConnectionSecret',
      };
    }

    const connectionSecretData = postgresDatabaseSecretSchema.safeParse(decodeSecret(connectionSecret.data));
    if (!connectionSecretData.success || !connectionSecretData.data) {
      return {
        ready: false,
        syncing: true,
        reason: 'SecretMissing',
      };
    }

    const secretData = postgresDatabaseConnectionSecretSchema.safeParse(decodeSecret(this.#databaseSecret.data));
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
      name: secretData.data.user,
      password: secretData.data.password,
    });
    await database.upsertDatabase({
      name: secretData.data.database,
      owner: secretData.data.user,
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

export { PostgresDatabaseResource, secretDataSchema as postgresDatabaseSecretSchema };
