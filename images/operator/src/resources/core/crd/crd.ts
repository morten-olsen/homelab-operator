import type { V1CustomResourceDefinition } from '@kubernetes/client-node';

import { Resource } from '#services/resources/resources.ts';

class CRD extends Resource<V1CustomResourceDefinition> {
  public static readonly apiVersion = 'apiextensions.k8s.io/v1';
  public static readonly kind = 'CustomResourceDefinition';
}

export { CRD };
