import type { KubernetesObject } from '@kubernetes/client-node';
import type { K8SGatewayV1 } from 'src/__generated__/resources/K8SGatewayV1.ts';

import { Resource, ResourceService, type ResourceOptions } from '#services/resources/resources.ts';
import { CRD } from '#resources/core/crd/crd.ts';
import { NotReadyError } from '#utils/errors.ts';

class Gateway extends Resource<KubernetesObject & K8SGatewayV1> {
  public static readonly apiVersion = 'networking.istio.io/v1';
  public static readonly kind = 'Gateway';

  #crd: CRD;

  constructor(options: ResourceOptions<KubernetesObject & K8SGatewayV1>) {
    super(options);
    const resourceService = this.services.get(ResourceService);
    this.#crd = resourceService.get(CRD, 'gateways.networking.istio.io');
    this.on('changed', this.#handleUpdate);
  }

  #handleUpdate = async () => {
    this.emit('changed');
  };

  public get hasCRD() {
    return this.#crd.exists;
  }

  public set = async (manifest: KubernetesObject & K8SGatewayV1) => {
    if (!this.hasCRD) {
      throw new NotReadyError('CRD is not installed');
    }
    await this.ensure(manifest);
  };
}

export { Gateway };
