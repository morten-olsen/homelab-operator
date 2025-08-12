import type { KubernetesObject } from '@kubernetes/client-node';

import { ResourceInstance } from '../services/resources/resources.instance.ts';
import type { K8SDestinationRuleV1 } from '../__generated__/resources/K8SDestinationRuleV1.ts';

class DestinationRuleInstance extends ResourceInstance<KubernetesObject & K8SDestinationRuleV1> {
  public get ready() {
    return this.exists;
  }
}

export { DestinationRuleInstance };
