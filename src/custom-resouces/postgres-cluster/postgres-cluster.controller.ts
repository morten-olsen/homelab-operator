import { ServiceInstance } from '../../instances/service.ts';
import { StatefulSetInstance } from '../../instances/stateful-set.ts';
import { ResourceService } from '../../services/resources/resources.ts';
import {
  CustomResource,
  type CustomResourceOptions,
} from '../../services/custom-resources/custom-resources.custom-resource.ts';
import type { EnsuredSecret } from '../../services/secrets/secrets.secret.ts';
import { SecretService } from '../../services/secrets/secrets.ts';

import { postgresClusterSecretSchema, type postgresClusterSpecSchema } from './postgres-cluster.schemas.ts';

class PostgresClusterController extends CustomResource<typeof postgresClusterSpecSchema> {
  #statefulSet: StatefulSetInstance;
  #headlessService: ServiceInstance;
  #service: ServiceInstance;
  #secret: EnsuredSecret<typeof postgresClusterSecretSchema>;

  constructor(options: CustomResourceOptions<typeof postgresClusterSpecSchema>) {
    super(options);
    const resourceService = this.services.get(ResourceService);
    const secretService = this.services.get(SecretService);
    this.#statefulSet = resourceService.getInstance(
      {
        apiVersion: 'apps/v1',
        kind: 'StatefulSet',
        name: this.name,
        namespace: this.namespace,
      },
      StatefulSetInstance,
    );
    this.#headlessService = resourceService.getInstance(
      {
        apiVersion: 'v1',
        kind: 'Service',
        name: `${this.name}-headless`,
        namespace: this.namespace,
      },
      ServiceInstance,
    );
    this.#service = resourceService.getInstance(
      {
        apiVersion: 'v1',
        kind: 'Service',
        name: this.name,
        namespace: this.namespace,
      },
      ServiceInstance,
    );
    this.#secret = secretService.ensure({
      name: this.name,
      namespace: this.namespace,
      schema: postgresClusterSecretSchema,
      generator: () => {
        return {
          database: 'postgres',
          host: `${this.name}.${this.namespace}.svc.cluster.local`,
          port: '5432',
          username: 'postgres',
          password: crypto.randomUUID(),
        };
      },
    });
    this.#statefulSet.on('changed', this.queueReconcile);
    this.#service.on('changed', this.queueReconcile);
    this.#headlessService.on('changed', this.queueReconcile);
    this.#secret.resource.on('changed', this.queueReconcile);
  }

  public reconcile = async () => {
    if (!this.exists || this.metadata?.deletionTimestamp || !this.#secret.isValid) {
      return;
    }
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
    await this.#statefulSet.ensure({
      metadata: {
        ownerReferences: [this.ref],
      },
      spec: {
        replicas: 1,
        serviceName: this.name,
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
                  { name: 'POSTGRES_PASSWORD', valueFrom: { secretKeyRef: { name: this.name, key: 'password' } } },
                  { name: 'POSTGRES_USER', valueFrom: { secretKeyRef: { name: this.name, key: 'username' } } },
                  { name: 'POSTGRES_DB', value: this.name },
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
            },
            spec: {
              accessModes: ['ReadWriteOnce'],
              storageClassName: `${this.spec.environment}-retain`,
              resources: {
                requests: {
                  storage: this.spec.storage?.size || '1Gi',
                },
              },
            },
          },
        ],
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

export { PostgresClusterController };
