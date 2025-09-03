import type { KubernetesObject } from '@kubernetes/client-node';
import type { K8SCertificateV1 } from 'src/__generated__/resources/K8SCertificateV1.ts';

import { CRD } from '#resources/core/crd/crd.ts';
import { Resource, ResourceService, type ResourceOptions } from '#services/resources/resources.ts';
import { NotReadyError } from '#utils/errors.ts';

class Certificate extends Resource<KubernetesObject & K8SCertificateV1> {
  public static readonly apiVersion = 'cert-manager.io/v1';
  public static readonly kind = 'Certificate';

  #crd: CRD;

  constructor(options: ResourceOptions<KubernetesObject & K8SCertificateV1>) {
    super(options);
    const resourceService = this.services.get(ResourceService);
    this.#crd = resourceService.get(CRD, 'certificates.cert-manager.io');
    this.#crd.on('changed', this.#handleCrdChanged);
  }

  #handleCrdChanged = () => {
    this.emit('changed', this.manifest);
  };

  public get hasCRD() {
    return this.#crd.exists;
  }

  public set = async (manifest: KubernetesObject & K8SCertificateV1) => {
    if (!this.hasCRD) {
      throw new NotReadyError('MissingCRD', 'certificates.cert-manager.io does not exist');
    }
    return this.ensure(manifest);
  };
}

export { Certificate };
