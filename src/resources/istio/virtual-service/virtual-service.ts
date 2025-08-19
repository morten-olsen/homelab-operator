import type { KubernetesObject } from '@kubernetes/client-node';
import type { K8SVirtualServiceV1 } from 'src/__generated__/resources/K8SVirtualServiceV1.ts';

import { Resource } from '#services/resources/resources.ts';

class VirtualService extends Resource<KubernetesObject & K8SVirtualServiceV1> {
  public static readonly apiVersion = 'networking.istio.io/v1';
  public static readonly kind = 'VirtualService';
}

export { VirtualService };
