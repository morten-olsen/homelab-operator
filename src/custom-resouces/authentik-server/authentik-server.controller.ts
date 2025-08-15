import type { V1Secret } from '@kubernetes/client-node';

import { RepoService } from '../../bootstrap/repos/repos.ts';
import { HelmReleaseInstance } from '../../instances/helm-release.ts';
import { SecretInstance } from '../../instances/secret.ts';
import {
  CustomResource,
  type CustomResourceOptions,
  type CustomResourceObject,
} from '../../services/custom-resources/custom-resources.custom-resource.ts';
import { ResourceReference } from '../../services/resources/resources.ref.ts';
import { ResourceService } from '../../services/resources/resources.ts';
import type { EnsuredSecret } from '../../services/secrets/secrets.secret.ts';
import { SecretService } from '../../services/secrets/secrets.ts';
import { API_VERSION } from '../../utils/consts.ts';
import { getWithNamespace } from '../../utils/naming.ts';
import { decodeSecret, encodeSecret } from '../../utils/secrets.ts';
import type { environmentSpecSchema } from '../environment/environment.schemas.ts';
import { HttpServiceInstance } from '../../instances/http-service.ts';
import type { redisServerSpecSchema } from '../redis-server/redis-server.schemas.ts';
import { PostgresDatabaseInstance } from '../../instances/postgres-database.ts';

import {
  authentikServerInitSecretSchema,
  authentikServerSecretSchema,
  type authentikServerSpecSchema,
} from './authentik-server.schemas.ts';

class AuthentikServerController extends CustomResource<typeof authentikServerSpecSchema> {
  #environment: ResourceReference<CustomResourceObject<typeof environmentSpecSchema>>;
  #authentikInitSecret: EnsuredSecret<typeof authentikServerInitSecretSchema>;
  #authentikSecret: SecretInstance;
  #authentikRelease: HelmReleaseInstance;
  #postgresSecret: ResourceReference<V1Secret>;
  #httpService: HttpServiceInstance;
  #redisServer: ResourceReference<CustomResourceObject<typeof redisServerSpecSchema>>;
  #postgresDatabase: PostgresDatabaseInstance;

  constructor(options: CustomResourceOptions<typeof authentikServerSpecSchema>) {
    super(options);
    const secretService = this.services.get(SecretService);
    const resourceService = this.services.get(ResourceService);

    this.#environment = new ResourceReference();
    this.#authentikInitSecret = secretService.ensure({
      owner: [this.ref],
      name: `${this.name}-init`,
      namespace: this.namespace,
      schema: authentikServerInitSecretSchema,
      generator: () => ({
        AUTHENTIK_BOOTSTRAP_TOKEN: crypto.randomUUID(),
        AUTHENTIK_BOOTSTRAP_PASSWORD: crypto.randomUUID(),
        AUTHENTIK_BOOTSTRAP_EMAIL: 'admin@example.com',
        AUTHENTIK_SECRET_KEY: crypto.randomUUID(),
      }),
    });
    this.#authentikSecret = resourceService.getInstance(
      {
        apiVersion: 'v1',
        kind: 'Secret',
        name: `${this.name}-server`,
        namespace: this.namespace,
      },
      SecretInstance<typeof authentikServerSecretSchema>,
    );
    this.#authentikRelease = resourceService.getInstance(
      {
        apiVersion: 'helm.toolkit.fluxcd.io/v2',
        kind: 'HelmRelease',
        name: this.name,
        namespace: this.namespace,
      },
      HelmReleaseInstance,
    );
    this.#httpService = resourceService.getInstance(
      {
        apiVersion: API_VERSION,
        kind: 'HttpService',
        name: this.name,
        namespace: this.namespace,
      },
      HttpServiceInstance,
    );
    this.#postgresDatabase = resourceService.getInstance(
      {
        apiVersion: API_VERSION,
        kind: 'PostgresDatabase',
        name: this.name,
        namespace: this.namespace,
      },
      PostgresDatabaseInstance,
    );
    this.#redisServer = new ResourceReference();
    this.#postgresSecret = new ResourceReference();
    this.#authentikSecret.on('changed', this.queueReconcile);
    this.#authentikInitSecret.resource.on('deleted', this.queueReconcile);
    this.#environment.on('changed', this.queueReconcile);
    this.#authentikRelease.on('changed', this.queueReconcile);
    this.#postgresSecret.on('changed', this.queueReconcile);
    this.#httpService.on('changed', this.queueReconcile);
    this.#redisServer.on('changed', this.queueReconcile);
  }

  public reconcile = async () => {
    if (!this.exists || this.metadata?.deletionTimestamp) {
      return;
    }

    if (!this.#authentikInitSecret.isValid) {
      await this.markNotReady('MissingAuthentikInitSecret', 'The authentik init secret is not found');
      return;
    }

    const resourceService = this.services.get(ResourceService);
    const environmentNames = getWithNamespace(this.spec.environment, this.namespace);

    this.#environment.current = resourceService.get({
      apiVersion: API_VERSION,
      kind: 'Environment',
      name: environmentNames.name,
      namespace: this.namespace,
    });

    await this.#postgresDatabase.ensure({
      metadata: {
        ownerReferences: [this.ref],
      },
      spec: {
        cluster: this.spec.postgresCluster,
      },
    });
    const postgresSecret = this.#postgresDatabase.secret;

    if (!postgresSecret.exists) {
      await this.markNotReady('MissingPostgresSecret', 'The postgres secret is not found');
      return;
    }
    const postgresSecretData = decodeSecret(postgresSecret.data) || {};

    if (!this.#environment.current?.exists) {
      await this.markNotReady(
        'MissingEnvironment',
        `Environment ${this.#environment.current?.namespace}/${this.#environment.current?.name} not found`,
      );
      return;
    }

    const domain = this.#environment.current.spec?.domain;
    if (!domain) {
      await this.markNotReady('MissingDomain', 'The domain is not set');
      return;
    }

    const secretData = {
      url: `https://${this.spec.subdomain}.${domain}`,
      host: `${this.name}-server.${this.namespace}.svc.cluster.local`,
      token: this.#authentikInitSecret.value?.AUTHENTIK_BOOTSTRAP_TOKEN ?? '',
    };

    await this.#authentikSecret.ensure({
      metadata: {
        ownerReferences: [this.ref],
      },
      data: encodeSecret(secretData),
    });

    const repoService = this.services.get(RepoService);

    const redisNames = getWithNamespace(this.spec.redisServer, this.namespace);
    const redisHost = `${redisNames.name}.${redisNames.namespace}.svc.cluster.local`;

    await this.#authentikRelease.ensure({
      metadata: {
        ownerReferences: [this.ref],
      },
      spec: {
        interval: '60m',
        chart: {
          spec: {
            chart: 'authentik',
            version: '2025.6.4',
            sourceRef: {
              apiVersion: 'source.toolkit.fluxcd.io/v1',
              kind: 'HelmRepository',
              name: repoService.authentik.name,
              namespace: repoService.authentik.namespace,
            },
          },
        },
        values: {
          global: {
            envFrom: [
              {
                secretRef: {
                  name: this.#authentikInitSecret.name,
                },
              },
            ],
          },
          authentik: {
            error_reporting: {
              enabled: false,
            },
            postgresql: {
              host: postgresSecretData.host,
              name: postgresSecretData.database,
              user: postgresSecretData.username,
              password: 'file:///postgres-creds/password',
            },
            redis: {
              host: redisHost,
            },
          },
          server: {
            volumes: [
              {
                name: 'postgres-creds',
                secret: {
                  secretName: postgresSecret.name,
                },
              },
            ],
            volumeMounts: [
              {
                name: 'postgres-creds',
                mountPath: '/postgres-creds',
                readOnly: true,
              },
            ],
          },
          worker: {
            volumes: [
              {
                name: 'postgres-creds',
                secret: {
                  secretName: postgresSecret.name,
                },
              },
            ],
            volumeMounts: [
              {
                name: 'postgres-creds',
                mountPath: '/postgres-creds',
                readOnly: true,
              },
            ],
          },
        },
      },
    });

    await this.#httpService.ensure({
      metadata: {
        ownerReferences: [this.ref],
      },
      spec: {
        environment: this.spec.environment,
        subdomain: this.spec.subdomain,
        destination: {
          host: `${this.name}-server.${this.namespace}.svc.cluster.local`,
          port: {
            number: 80,
          },
        },
      },
    });
    await this.markReady();
  };
}

export { AuthentikServerController };
