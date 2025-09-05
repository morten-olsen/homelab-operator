import type { V1Service } from '@kubernetes/client-node';

import { Resource } from '#services/resources/resources.ts';

class Service extends Resource<V1Service> {
  public static readonly apiVersion = 'v1';
  public static readonly kind = 'Service';

  public get hostname() {
    return `${this.name}.${this.namespace}.svc.cluster.local`;
  }
}

export { Service };
