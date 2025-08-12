import type { KubernetesObject } from '@kubernetes/client-node';

import { ResourceInstance } from '../services/resources/resources.ts';
import type { K8SHelmRepositoryV1 } from '../__generated__/resources/K8SHelmRepositoryV1.ts';

class HelmRepoInstance extends ResourceInstance<KubernetesObject & K8SHelmRepositoryV1> {
  public get ready() {
    if (!this.exists) {
      return false;
    }
    const condition = this.getCondition('Ready');
    return condition?.status === 'True';
  }
}

export { HelmRepoInstance };
