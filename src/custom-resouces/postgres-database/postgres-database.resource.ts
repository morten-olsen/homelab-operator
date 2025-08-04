import { z } from 'zod';
import type { V1Secret } from '@kubernetes/client-node';

import {
  CustomResource,
  type CustomResourceObject,
  type CustomResourceOptions,
  type SubresourceResult,
} from '../../services/custom-resources/custom-resources.custom-resource.ts';
import { PostgresService } from '../../services/postgres/postgres.service.ts';
import {
  postgresConnectionSecretDataSchema,
  type postgresConnectionSpecSchema,
} from '../postgres-connection/posgtres-connection.schemas.ts';
import { ResourceReference } from '../../services/resources/resources.ref.ts';
import { Resource, ResourceService } from '../../services/resources/resources.ts';
import { getWithNamespace } from '../../utils/naming.ts';
import { API_VERSION } from '../../utils/consts.ts';
import { decodeSecret } from '../../utils/secrets.ts';

import type { postgresDatabaseSpecSchema } from './portgres-database.schemas.ts';

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
  #secret: Resource<V1Secret>;
  #secretName: string;
  #connection: ResourceReference<CustomResourceObject<typeof postgresConnectionSpecSchema>>;
  #connectionSecret: ResourceReference<V1Secret>;

  constructor(options: CustomResourceOptions<typeof postgresDatabaseSpecSchema>) {
    super(options);
    const resouceService = this.services.get(ResourceService);

    this.#secretName = `postgres-database-${this.name}`;
    this.#secret = resouceService.get({
      apiVersion: 'v1',
      kind: 'Secret',
      name: this.#secretName,
      namespace: this.namespace,
    });

    this.#connection = new ResourceReference();
    this.#connectionSecret = new ResourceReference();

    this.#updateSecret();

    this.#secret.on('changed', this.queueReconcile);
    this.#connection.on('changed', this.queueReconcile);
    this.#connectionSecret.on('changed', this.queueReconcile);
  }

  get #dbName() {
    return `${this.namespace}_${this.name}`;
  }

  get #userName() {
    return `${this.namespace}_${this.name}`;
  }

  #updateSecret = () => {
    const resouceService = this.services.get(ResourceService);
    const connectionNames = getWithNamespace(this.spec.connection, this.namespace);
    this.#connection.current = resouceService.get({
      apiVersion: API_VERSION,
      kind: 'PostgresConnection',
      name: connectionNames.name,
      namespace: connectionNames.namespace,
    });
    if (this.#connection.current?.exists && this.#connection.current.spec) {
      const connectionSecretNames = getWithNamespace(
        this.#connection.current.spec.secret,
        this.#connection.current.namespace,
      );
      this.#connectionSecret.current = resouceService.get({
        apiVersion: 'v1',
        kind: 'Secret',
        name: connectionSecretNames.name,
        namespace: connectionSecretNames.namespace,
      });
    }
  };

  #reconcileSecret = async (): Promise<SubresourceResult> => {
    const connectionSecret = this.#connectionSecret.current;
    if (!connectionSecret?.exists || !connectionSecret.data) {
      return {
        ready: false,
        failed: true,
        reason: 'MissingConnectionSecret',
      };
    }

    const connectionSecretData = decodeSecret(connectionSecret.data);

    const secret = this.#secret;
    const parsed = secretDataSchema.safeParse(decodeSecret(secret.data));

    if (!parsed.success) {
      this.#secret.patch({
        data: {
          host: Buffer.from(connectionSecretData?.host || '').toString('base64'),
          port: connectionSecretData?.port ? Buffer.from(connectionSecretData.port).toString('base64') : undefined,
          user: Buffer.from(this.#userName).toString('base64'),
          database: Buffer.from(this.#dbName).toString('base64'),
          password: Buffer.from(Buffer.from(crypto.randomUUID()).toString('hex')).toString('base64'),
        },
      });
      return {
        ready: false,
        syncing: true,
      };
    }
    if (parsed.data?.host !== connectionSecretData?.host || parsed.data?.port !== connectionSecretData?.port) {
      this.#secret.patch({
        data: {
          host: Buffer.from(connectionSecretData?.host || '').toString('base64'),
          port: connectionSecretData?.port ? Buffer.from(connectionSecretData.port).toString('base64') : undefined,
        },
      });
      return {
        ready: false,
        syncing: true,
      };
    }

    return {
      ready: true,
    };
  };

  #reconcileDatabase = async (): Promise<SubresourceResult> => {
    const connectionSecret = this.#connectionSecret.current;
    if (!connectionSecret?.exists || !connectionSecret.data) {
      return {
        ready: false,
        failed: true,
        reason: 'MissingConnectionSecret',
      };
    }

    const connectionSecretData = postgresConnectionSecretDataSchema.safeParse(decodeSecret(connectionSecret.data));
    if (!connectionSecretData.success || !connectionSecretData.data) {
      return {
        ready: false,
        syncing: true,
        reason: 'ConnectionSecretMissing',
      };
    }

    const secretData = secretDataSchema.safeParse(decodeSecret(this.#secret.data));
    if (!secretData.success || !secretData.data) {
      return {
        ready: false,
        syncing: true,
        reason: 'SecretMissing',
      };
    }

    const postgresService = this.services.get(PostgresService);
    const database = postgresService.get({
      ...connectionSecretData.data,
      port: connectionSecretData.data.port ? Number(connectionSecretData.data.port) : 5432,
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
    this.#updateSecret();
    if (!this.exists || this.metadata.deletionTimestamp) {
      return;
    }
    await Promise.allSettled([
      await this.reconcileSubresource(DATABASE_READY_CONDITION, this.#reconcileDatabase),
      await this.reconcileSubresource(SECRET_READY_CONDITION, this.#reconcileSecret),
    ]);

    const secretReady = this.conditions.get(SECRET_READY_CONDITION)?.status === 'True';
    const databaseReady = this.conditions.get(DATABASE_READY_CONDITION)?.status === 'True';
    await this.conditions.set('Ready', {
      status: secretReady && databaseReady ? 'True' : 'False',
    });
  };
}

export { PostgresDatabaseResource, secretDataSchema as postgresDatabaseSecretSchema };
