import type { V1Secret } from '@kubernetes/client-node';

import {
  CustomResource,
  type CustomResourceOptions,
} from '../../services/custom-resources/custom-resources.custom-resource.ts';
import { ResourceReference } from '../../services/resources/resources.ref.ts';
import { ResourceService } from '../../services/resources/resources.ts';
import { getWithNamespace } from '../../utils/naming.ts';

import type { redisConnectionSpecSchema } from './redis-connection.schemas.ts';

class RedisConnectionResource extends CustomResource<typeof redisConnectionSpecSchema> {
  #secret: ResourceReference<V1Secret>;

  constructor(options: CustomResourceOptions<typeof redisConnectionSpecSchema>) {
    super(options);
    const resourceService = this.services.get(ResourceService);
    const secretNames = getWithNamespace(this.spec.secret, this.namespace);
    this.#secret = new ResourceReference<V1Secret>(
      resourceService.get({
        apiVersion: 'v1',
        kind: 'Secret',
        name: secretNames.name,
        namespace: secretNames.namespace,
      }),
    );
    this.#secret.on('changed', this.queueReconcile);
  }

  public reconcile = async () => {
    const resourceService = this.services.get(ResourceService);
    const secretNames = getWithNamespace(this.spec.secret, this.namespace);
    this.#secret.current = resourceService.get({
      apiVersion: 'v1',
      kind: 'Secret',
      name: secretNames.name,
      namespace: secretNames.namespace,
    });

    const current = this.#secret.current;
    if (!current?.exists || !current.data) {
      return this.conditions.set('Ready', {
        status: 'False',
        reason: 'MissingSecret',
      });
    }
    const { host } = current.data;
    if (!host) {
      return this.conditions.set('Ready', {
        status: 'False',
        reason: 'MissingHost',
      });
    }
    await this.conditions.set('Ready', {
      status: 'True',
    });
  };
}

export { RedisConnectionResource };
