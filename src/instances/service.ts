import type { V1Service } from '@kubernetes/client-node';

import { ResourceInstance } from '../services/resources/resources.ts';

class ServiceInstance extends ResourceInstance<V1Service> {
  public get ready() {
    return this.exists;
  }
}

export { ServiceInstance };
