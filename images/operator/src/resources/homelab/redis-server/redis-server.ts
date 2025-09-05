import { z } from 'zod';

import { Deployment } from '#resources/core/deployment/deployment.ts';
import { Service } from '#resources/core/service/service.ts';
import { CustomResource, ResourceService, type CustomResourceOptions } from '#services/resources/resources.ts';
import { API_VERSION } from '#utils/consts.ts';

const specSchema = z.object({});

class RedisServer extends CustomResource<typeof specSchema> {
  public static readonly apiVersion = API_VERSION;
  public static readonly kind = 'RedisServer';
  public static readonly spec = specSchema;
  public static readonly scope = 'Namespaced';

  #deployment: Deployment;
  #service: Service;

  constructor(options: CustomResourceOptions<typeof specSchema>) {
    super(options);
    const resourceService = this.services.get(ResourceService);
    this.#deployment = resourceService.get(Deployment, this.name, this.namespace);
    this.#service = resourceService.get(Service, this.name, this.namespace);
  }

  public get deployment() {
    return this.#deployment;
  }

  public get service() {
    return this.#service;
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

export { RedisServer };
