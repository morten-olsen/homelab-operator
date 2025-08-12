import type { KubernetesObject } from '@kubernetes/client-node';

import { ResourceInstance } from '../services/resources/resources.instance.ts';
import type { K8SVirtualServiceV1 } from '../__generated__/resources/K8SVirtualServiceV1.ts';

class VirtualServiceInstance extends ResourceInstance<KubernetesObject & K8SVirtualServiceV1> {
  public get ready() {
    return this.exists;
  }
}

export { VirtualServiceInstance };
