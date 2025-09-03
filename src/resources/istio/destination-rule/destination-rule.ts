import type { KubernetesObject } from '@kubernetes/client-node';
import type { K8SDestinationRuleV1 } from 'src/__generated__/resources/K8SDestinationRuleV1.ts';

import { Resource, ResourceService, type ResourceOptions } from '#services/resources/resources.ts';
import { CRD } from '#resources/core/crd/crd.ts';
import { NotReadyError } from '#utils/errors.ts';

class DestinationRule extends Resource<KubernetesObject & K8SDestinationRuleV1> {
  public static readonly apiVersion = 'networking.istio.io/v1';
  public static readonly kind = 'DestinationRule';

  #crd: CRD;

  constructor(options: ResourceOptions<KubernetesObject & K8SDestinationRuleV1>) {
    super(options);
    const resourceService = this.services.get(ResourceService);
    this.#crd = resourceService.get(CRD, 'destinationrules.networking.istio.io');
    this.#crd.on('changed', this.#handleChange);
  }

  public get hasCRD() {
    return this.#crd.exists;
  }

  #handleChange = () => {
    this.emit('changed', this.manifest);
  };

  public set = async (manifest: KubernetesObject & K8SDestinationRuleV1) => {
    if (!this.hasCRD) {
      throw new NotReadyError('CRD is not installed');
    }
    await this.ensure(manifest);
  };
}

export { DestinationRule };
