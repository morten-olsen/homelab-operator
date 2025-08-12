import type { KubernetesObject } from '@kubernetes/client-node';

import { ResourceInstance } from '../services/resources/resources.ts';
import type { K8SHelmReleaseV2 } from '../__generated__/resources/K8SHelmReleaseV2.ts';

class HelmReleaseInstance extends ResourceInstance<KubernetesObject & K8SHelmReleaseV2> {
  public get ready() {
    return this.exists;
  }
}

export { HelmReleaseInstance };
