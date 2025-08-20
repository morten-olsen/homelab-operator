import type { KubernetesObject } from '@kubernetes/client-node';
import type { K8SVirtualServiceV1 } from 'src/__generated__/resources/K8SVirtualServiceV1.ts';

import { Resource, ResourceService, type ResourceOptions } from '#services/resources/resources.ts';
import { CRD } from '#resources/core/crd/crd.ts';
import { NotReadyError } from '#utils/errors.ts';

class VirtualService extends Resource<KubernetesObject & K8SVirtualServiceV1> {
  public static readonly apiVersion = 'networking.istio.io/v1';
  public static readonly kind = 'VirtualService';

  #crd: CRD;

  constructor(options: ResourceOptions<KubernetesObject & K8SVirtualServiceV1>) {
    super(options);
    const resourceService = this.services.get(ResourceService);
    this.#crd = resourceService.get(CRD, 'virtualservices.networking.istio.io');
    this.#crd.on('changed', this.#handleChange);
  }

  public get hasCRD() {
    return this.#crd.exists;
  }

  #handleChange = () => {
    this.emit('changed', this.manifest);
  };

  public set = async (manifest: KubernetesObject & K8SVirtualServiceV1) => {
    if (!this.hasCRD) {
      throw new NotReadyError('CRD is not installed');
    }
    await this.ensure(manifest);
  };
}

export { VirtualService };
