import type { V1Secret } from '@kubernetes/client-node';

import {
  CustomResource,
  type CustomResourceOptions,
} from '../../services/custom-resources/custom-resources.custom-resource.ts';
import { Resource, ResourceService } from '../../services/resources/resources.ts';
import { decodeSecret, encodeSecret } from '../../utils/secrets.ts';
import { isDeepSubset } from '../../utils/objects.ts';

import { generateSecrets } from './generate-secret.utils.ts';
import { generateSecretSpecSchema } from './generate-secret.schemas.ts';

class GenerateSecretResource extends CustomResource<typeof generateSecretSpecSchema> {
  #secretResource: Resource<V1Secret>;

  constructor(options: CustomResourceOptions<typeof generateSecretSpecSchema>) {
    super(options);
    const resourceService = this.services.get(ResourceService);

    this.#secretResource = resourceService.get({
      apiVersion: 'v1',
      kind: 'Secret',
      name: this.name,
      namespace: this.namespace,
    });

    this.#secretResource.on('changed', this.queueReconcile);
  }

  public reconcile = async () => {
    if (!this.exists || this.metadata?.deletionTimestamp) {
      return;
    }

    const secrets = generateSecrets(this.spec);
    const current = decodeSecret(this.#secretResource.data) || {};

    const expected = {
      ...current,
      ...secrets,
    };

    if (!isDeepSubset(current, expected)) {
      this.#secretResource.patch({
        data: encodeSecret(expected),
      });
      this.conditions.set('SecretUpdated', {
        status: 'False',
        reason: 'SecretUpdated',
      });
    }

    this.conditions.set('Ready', {
      status: 'True',
      reason: 'Ready',
    });
  };
}

export { GenerateSecretResource };
