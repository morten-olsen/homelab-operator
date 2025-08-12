import type { KubernetesObject } from '@kubernetes/client-node';

import type { K8SClusterIssuerV1 } from '../__generated__/resources/K8SClusterIssuerV1.ts';
import { ResourceInstance } from '../services/resources/resources.instance.ts';

class ClusterIssuerInstance extends ResourceInstance<KubernetesObject & K8SClusterIssuerV1> {
  public get ready() {
    return this.exists;
  }
}

export { ClusterIssuerInstance };
