import { DeploymentInstance } from '../../instances/deployment.ts';
import { ServiceInstance } from '../../instances/service.ts';
import { CustomResource } from '../../services/custom-resources/custom-resources.custom-resource.ts';
import type { CustomResourceOptions } from '../../services/custom-resources/custom-resources.custom-resource.ts';
import { ResourceService } from '../../services/resources/resources.ts';

import type { redisServerSpecSchema } from './redis-server.schemas.ts';

class RedisServerController extends CustomResource<typeof redisServerSpecSchema> {
  #deployment: DeploymentInstance;
  #service: ServiceInstance;

  constructor(options: CustomResourceOptions<typeof redisServerSpecSchema>) {
    super(options);
    const resourceService = this.services.get(ResourceService);
    this.#deployment = resourceService.getInstance(
      {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        name: this.name,
        namespace: this.namespace,
      },
      DeploymentInstance,
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
    this.#deployment.on('changed', this.queueReconcile);
    this.#service.on('changed', this.queueReconcile);
  }

  public reconcile = async () => {
    await this.#deployment.ensure({
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
                image: 'redis:latest',
                ports: [{ containerPort: 6379 }],
              },
            ],
          },
        },
      },
    });
    await this.#service.ensure({
      metadata: {
        ownerReferences: [this.ref],
      },
      spec: {
        selector: {
          app: this.name,
        },
        ports: [{ port: 6379, targetPort: 6379 }],
      },
    });
  };
}

export { RedisServerController };
