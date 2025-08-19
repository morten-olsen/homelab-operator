import type { KubernetesObject } from '@kubernetes/client-node';
import type { K8SGatewayV1 } from 'src/__generated__/resources/K8SGatewayV1.ts';

import { Resource } from '#services/resources/resources.ts';

class Gateway extends Resource<KubernetesObject & K8SGatewayV1> {
  public static readonly apiVersion = 'networking.istio.io/v1';
  public static readonly kind = 'Gateway';
}

export { Gateway };
