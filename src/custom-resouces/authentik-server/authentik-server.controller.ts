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

import { authentikServerInitSecretSchema, type authentikServerSpecSchema } from './authentik-server.schemas.ts';

class AuthentikServerController extends CustomResource<typeof authentikServerSpecSchema> {
  #environment: ResourceReference<CustomResourceObject<typeof environmentSpecSchema>>;
  #authentikInitSecret: EnsuredSecret<typeof authentikServerInitSecretSchema>;
  #authentikSecret: SecretInstance;
  #authentikRelease: HelmReleaseInstance;
  #postgresSecret: ResourceReference<V1Secret>;

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
      SecretInstance,
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
    this.#postgresSecret = new ResourceReference();
    this.#authentikSecret.on('changed', this.queueReconcile);
    this.#authentikInitSecret.resource.on('deleted', this.queueReconcile);
    this.#environment.on('changed', this.queueReconcile);
    this.#authentikRelease.on('changed', this.queueReconcile);
    this.#postgresSecret.on('changed', this.queueReconcile);
  }

  public reconcile = async () => {
    if (!this.exists || this.metadata?.deletionTimestamp) {
      return;
    }

    if (!this.#authentikInitSecret.isValid) {
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

    const postgresNames = getWithNamespace(this.spec.postgresCluster, this.namespace);
    this.#postgresSecret.current = resourceService.get({
      apiVersion: 'v1',
      kind: 'Secret',
      name: postgresNames.name,
      namespace: postgresNames.namespace,
    });

    if (!this.#postgresSecret.current?.exists) {
      return;
    }
    const postgresSecret = decodeSecret(this.#postgresSecret.current.data) || {};

    if (!this.#environment.current?.exists) {
      return;
    }

    const domain = this.#environment.current.spec?.domain;
    if (!domain) {
      return;
    }

    const secretData = {
      url: `https://${this.spec.subdomain}.${domain}`,
      host: `${this.name}.${this.namespace}.svc.cluster.local`,
      token: this.#authentikInitSecret.value?.AUTHENTIK_BOOTSTRAP_TOKEN ?? '',
    };

    await this.#authentikSecret.ensure({
      metadata: {
        ownerReferences: [this.ref],
      },
      data: encodeSecret(secretData),
    });

    const repoService = this.services.get(RepoService);

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
              host: postgresSecret.host,
              name: postgresSecret.database,
              user: postgresSecret.username,
              password: 'file:///postgres-creds/password',
            },
            redis: {
              host: `redis.${this.namespace}.svc.cluster.local`,
            },
          },
          server: {
            volumes: [
              {
                name: 'postgres-creds',
                secret: {
                  secretName: this.#postgresSecret.current.name,
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
                  secretName: this.#postgresSecret.current.name,
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
  };
}

export { AuthentikServerController };
