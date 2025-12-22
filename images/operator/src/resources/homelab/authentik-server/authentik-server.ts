import { z } from 'zod';

import { PostgresDatabase } from '../postgres-database/postgres-database.ts';
import { Environment } from '../environment/environment.ts';

import {
  CustomResource,
  ResourceReference,
  ResourceService,
  type CustomResourceOptions,
} from '#services/resources/resources.ts';
import { API_VERSION } from '#utils/consts.ts';
import { Secret } from '#resources/core/secret/secret.ts';
import { generateRandomHexPass } from '#utils/secrets.ts';
import { Service } from '#resources/core/service/service.ts';
import { HelmRelease } from '#resources/flux/helm-release/helm-release.ts';
import { RepoService } from '#bootstrap/repos/repos.ts';
import { DestinationRule } from '#resources/istio/destination-rule/destination-rule.ts';
import { NotReadyError } from '#utils/errors.ts';
import { ExternalHttpService } from '../external-http-service.ts/external-http-service.ts';

const specSchema = z.object({
  environment: z.string(),
  subdomain: z.string().optional(),
});

type SecretData = { url: string; host: string; token: string };
type InitSecretData = {
  AUTHENTIK_BOOTSTRAP_TOKEN: string;
  AUTHENTIK_BOOTSTRAP_PASSWORD: string;
  AUTHENTIK_BOOTSTRAP_EMAIL: string;
  AUTHENTIK_SECRET_KEY: string;
};

class AuthentikServer extends CustomResource<typeof specSchema> {
  public static readonly apiVersion = API_VERSION;
  public static readonly kind = 'AuthentikServer';
  public static readonly spec = specSchema;
  public static readonly scope = 'Namespaced';

  #environment: ResourceReference<typeof Environment>;
  #database: PostgresDatabase;
  #secret: Secret<SecretData>;
  #initSecret: Secret<InitSecretData>;
  #service: Service;
  #helmRelease: HelmRelease;
  #externalHttpService: ExternalHttpService;
  #destinationRule: DestinationRule;

  constructor(options: CustomResourceOptions<typeof specSchema>) {
    super(options);

    const resourceService = this.services.get(ResourceService);
    this.#environment = new ResourceReference();
    this.#environment.on('changed', this.queueReconcile);

    this.#database = resourceService.get(PostgresDatabase, this.name, this.namespace);
    this.#database.on('changed', this.queueReconcile);

    this.#secret = resourceService.get(Secret<SecretData>, this.name, this.namespace);
    this.#secret.on('changed', this.queueReconcile);

    this.#initSecret = resourceService.get(Secret<InitSecretData>, `${this.name}-init`, this.namespace);

    this.#service = resourceService.get(Service, `${this.name}-server`, this.namespace);
    // this.#service.on('changed', this.queueReconcile);

    this.#helmRelease = resourceService.get(HelmRelease, this.name, this.namespace);
    this.#helmRelease.on('changed', this.queueReconcile);

    this.#destinationRule = resourceService.get(DestinationRule, this.name, this.namespace);
    this.#destinationRule.on('changed', this.queueReconcile);

    this.#externalHttpService = resourceService.get(ExternalHttpService, this.name, this.namespace);
  }

  public get service() {
    return this.#service;
  }

  public get secret() {
    return this.#secret;
  }

  public get subdomain() {
    return this.spec?.subdomain || 'authentik';
  }

  public get domain() {
    return `${this.subdomain}.${this.#environment.current?.spec?.domain}`;
  }

  public get url() {
    return `https://${this.domain}`;
  }

  public reconcile = async () => {
    if (!this.spec) {
      throw new NotReadyError('MissingSpec');
    }
    const resourceService = this.services.get(ResourceService);

    this.#environment.current = resourceService.get(Environment, this.spec.environment);
    if (!this.#environment.current.spec) {
      throw new NotReadyError('MissingEnvSpev');
    }

    await this.#database.ensure({
      metadata: {
        ownerReferences: [this.ref],
      },
      spec: {
        environment: this.#environment.current.name,
      },
    });

    const databaseSecret = this.#database.secret.value;
    if (!databaseSecret) {
      throw new NotReadyError('MissingDatabaseSecret');
    }

    await this.#initSecret.set(
      (current) => ({
        AUTHENTIK_BOOTSTRAP_EMAIL: 'admin@example.com',
        AUTHENTIK_BOOTSTRAP_PASSWORD: generateRandomHexPass(24),
        AUTHENTIK_BOOTSTRAP_TOKEN: generateRandomHexPass(32),
        AUTHENTIK_SECRET_KEY: generateRandomHexPass(32),
        ...current,
      }),
      {
        metadata: {
          ownerReferences: [this.ref],
        },
      },
    );

    const initSecret = this.#initSecret.value;
    if (!initSecret) {
      throw new NotReadyError('MissingInitSecret');
    }

    const domain = `${this.spec?.subdomain || 'authentik'}.${this.#environment.current.spec.domain}`;
    await this.#secret.set(
      {
        url: `https://${domain}`,
        host: this.#service.hostname,
        token: initSecret.AUTHENTIK_BOOTSTRAP_TOKEN,
      },
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

    const repoService = this.services.get(RepoService);

    await this.#helmRelease.ensure({
      metadata: {
        ownerReferences: [this.ref],
      },
      spec: {
        interval: '60m',
        chart: {
          spec: {
            chart: 'authentik',
            version: '2025.10.3',
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
                  name: this.#initSecret.name,
                },
              },
            ],
          },
          authentik: {
            error_reporting: {
              enabled: false,
            },
            postgresql: {
              host: databaseSecret.host,
              name: databaseSecret.database,
              user: databaseSecret.user,
              password: 'file:///postgres-creds/password',
            },
            redis: {
              host: this.#environment.current.redisServer.service.hostname,
            },
          },
          server: {
            volumes: [
              {
                name: 'postgres-creds',
                secret: {
                  secretName: this.#database.secret.name,
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
                  secretName: this.#database.secret.name,
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

    await this.#destinationRule.ensure({
      metadata: {
        ownerReferences: [this.ref],
      },
      spec: {
        host: this.#service.hostname,
        trafficPolicy: {
          tls: {
            mode: 'DISABLE',
          },
        },
      },
    });

    await this.#externalHttpService.ensure({
      metadata: {
        ownerReferences: [this.ref],
      },
      spec: {
        environment: this.spec.environment,
        subdomain: this.spec.subdomain || 'authentik',
        destination: {
          host: this.#service.hostname,
          port: {
            number: 80,
          },
        },
      },
    });
  };
}

export { AuthentikServer };
