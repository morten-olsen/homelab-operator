import type { KubernetesObject } from '@kubernetes/client-node';
import type { K8SDestinationRuleV1 } from 'src/__generated__/resources/K8SDestinationRuleV1.ts';

import { Resource } from '#services/resources/resources.ts';

class DestinationRule extends Resource<KubernetesObject & K8SDestinationRuleV1> {
  public static readonly apiVersion = 'networking.istio.io/v1';
  public static readonly kind = 'DestinationRule';
}

export { DestinationRule };
