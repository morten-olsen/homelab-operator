import type { V1Namespace } from '@kubernetes/client-node';

import { Resource } from '#services/resources/resources.ts';

class Namespace extends Resource<V1Namespace> {
  public static readonly apiVersion = 'v1';
  public static readonly kind = 'Namespace';
}

export { Namespace };
