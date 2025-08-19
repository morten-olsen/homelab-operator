import { z } from 'zod';

import { Secret } from '#resources/core/secret/secret.ts';
import { StatefulSet } from '#resources/core/stateful-set/stateful-set.ts';
import { CustomResource, ResourceService, type CustomResourceOptions } from '#services/resources/resources.ts';
import { API_VERSION } from '#utils/consts.ts';
import { Service } from '#resources/core/service/service.ts';
import { generateRandomHexPass } from '#utils/secrets.ts';

const specSchema = z.object({
  storageClass: z.string(),
  storage: z
    .object({
      size: z.string().optional(),
    })
    .optional(),
});

type SecretData = {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
};

class PostgresCluster extends CustomResource<typeof specSchema> {
  public static readonly apiVersion = API_VERSION;
  public static readonly kind = 'PostgresCluster';
  public static readonly spec = specSchema;
  public static readonly scope = 'Namespaced';

  #secret: Secret<SecretData>;
  #statefulSet: StatefulSet;
  #headlessService: Service;
  #service: Service;

  constructor(options: CustomResourceOptions<typeof specSchema>) {
    super(options);

    const resourceService = this.services.get(ResourceService);
    this.#secret = resourceService.get(Secret<SecretData>, this.name, this.namespace);
    this.#secret.on('changed', this.queueReconcile);

    this.#statefulSet = resourceService.get(StatefulSet, this.name, this.namespace);
    this.#statefulSet.on('changed', this.queueReconcile);

    this.#service = resourceService.get(Service, this.name, this.namespace);
    this.#service.on('changed', this.queueReconcile);

    this.#headlessService = resourceService.get(Service, `${this.name}-headless`, this.namespace);
    this.#headlessService.on('changed', this.queueReconcile);
  }

  public get secret() {
    return this.#secret;
  }

  public get statefulSet() {
    return this.#statefulSet;
  }

  public get headlessService() {
    return this.#headlessService;
  }

  public get service() {
    return this.#service;
  }

  public reconcile = async () => {
    await this.#secret.set(
      (current) => ({
        password: generateRandomHexPass(16),
        user: 'homelab',
        database: 'homelab',
        ...current,
        host: `${this.#service.name}.${this.#service.namespace}.svc.cluster.local`,
        port: '5432',
      }),
      {
        metadata: {
          ownerReferences: [this.ref],
        },
      },
    );

    const secretName = this.#secret.name;

    await this.#statefulSet.ensure({
      metadata: {
        ownerReferences: [this.ref],
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            app: this.name,
          },
        },
        template: {
          metadata: {
            labels: {
              app: this.name,
            },
          },
          spec: {
            containers: [
              {
                name: this.name,
                image: 'postgres:17',
                ports: [{ containerPort: 5432, name: 'postgres' }],
                env: [
                  { name: 'POSTGRES_PASSWORD', valueFrom: { secretKeyRef: { name: secretName, key: 'password' } } },
                  { name: 'POSTGRES_USER', valueFrom: { secretKeyRef: { name: secretName, key: 'user' } } },
                  { name: 'POSTGRES_DB', valueFrom: { secretKeyRef: { name: secretName, key: 'database' } } },
                  { name: 'PGDATA', value: '/var/lib/postgresql/data/pgdata' },
                ],
                volumeMounts: [{ name: this.name, mountPath: '/var/lib/postgresql/data' }],
              },
            ],
          },
        },
        volumeClaimTemplates: [
          {
            metadata: {
              name: this.name,
              ownerReferences: [this.ref],
            },
            spec: {
              accessModes: ['ReadWriteOnce'],
              storageClassName: this.spec?.storageClass,
              resources: {
                requests: {
                  storage: this.spec?.storage?.size || '1Gi',
                },
              },
            },
          },
        ],
      },
    });

    await this.#headlessService.ensure({
      metadata: {
        ownerReferences: [this.ref],
      },
      spec: {
        clusterIP: 'None',
        selector: {
          app: this.name,
        },
        ports: [{ name: 'postgres', port: 5432, targetPort: 5432 }],
      },
    });

    await this.#service.ensure({
      metadata: {
        ownerReferences: [this.ref],
      },
      spec: {
        type: 'ClusterIP',
        selector: {
          app: this.name,
        },
        ports: [{ name: 'postgres', port: 5432, targetPort: 5432 }],
      },
    });
  };
}

export { PostgresCluster };
