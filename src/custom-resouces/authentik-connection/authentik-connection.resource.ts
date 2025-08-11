import type { V1Secret } from '@kubernetes/client-node';
import deepEqual from 'deep-equal';

import {
  CustomResource,
  type CustomResourceOptions,
} from '../../services/custom-resources/custom-resources.custom-resource.ts';
import { ResourceService, type Resource } from '../../services/resources/resources.ts';
import type { ValueReference } from '../../services/value-reference/value-reference.instance.ts';
import { ValueReferenceService } from '../../services/value-reference/value-reference.ts';
import { decodeSecret, encodeSecret } from '../../utils/secrets.ts';

import type { authentikConnectionSpecSchema } from './authentik-connection.schemas.ts';

class AuthentikConnectionResource extends CustomResource<typeof authentikConnectionSpecSchema> {
  #name: ValueReference;
  #url: ValueReference;
  #token: ValueReference;
  #secret: Resource<V1Secret>;

  constructor(options: CustomResourceOptions<typeof authentikConnectionSpecSchema>) {
    super(options);
    const valueReferenceService = this.services.get(ValueReferenceService);
    const resourceService = this.services.get(ResourceService);

    this.#name = valueReferenceService.get(this.namespace);
    this.#url = valueReferenceService.get(this.namespace);
    this.#token = valueReferenceService.get(this.namespace);
    this.#secret = resourceService.get({
      apiVersion: 'v1',
      kind: 'Secret',
      name: `${this.name}-authentik-server`,
      namespace: this.namespace,
    });

    this.#name.on('changed', this.queueReconcile);
    this.#url.on('changed', this.queueReconcile);
    this.#token.on('changed', this.queueReconcile);
    this.#secret.on('changed', this.queueReconcile);
  }

  #updateResources = () => {
    this.#name.ref = this.spec.name;
    this.#url.ref = this.spec.url;
    this.#token.ref = this.spec.token;
  };

  public reconcile = async () => {
    this.#updateResources();
    const name = this.#name.value;
    const url = this.#url.value;
    const token = this.#token.value;
    if (!name) {
      return await this.conditions.set('Ready', {
        status: 'False',
        reason: 'MissingName',
      });
    }
    if (!url) {
      return await this.conditions.set('Ready', {
        status: 'False',
        reason: 'MissingUrl',
      });
    }
    if (!token) {
      return await this.conditions.set('Ready', {
        status: 'False',
        reason: 'MissingToken',
      });
    }
    const values = {
      name,
      url,
      token,
    };
    const secretValue = decodeSecret(this.#secret.data);
    if (!deepEqual(secretValue, values)) {
      await this.#secret.patch({
        data: encodeSecret(values),
      });
      return await this.conditions.set('Ready', {
        status: 'False',
        reason: 'UpdatingSecret',
      });
    }

    return await this.conditions.set('Ready', {
      status: 'True',
    });
  };
}

export { AuthentikConnectionResource };
