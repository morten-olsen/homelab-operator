import type { V1StatefulSet } from '@kubernetes/client-node';

import { Resource } from '#services/resources/resources.ts';

class StatefulSet extends Resource<V1StatefulSet> {
  public static readonly apiVersion = 'apps/v1';
  public static readonly kind = 'StatefulSet';
}

export { StatefulSet };
