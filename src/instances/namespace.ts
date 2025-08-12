import type { V1Namespace } from '@kubernetes/client-node';

import { ResourceInstance } from '../services/resources/resources.ts';

class NamespaceInstance extends ResourceInstance<V1Namespace> {
  public get ready() {
    return this.exists;
  }
}

export { NamespaceInstance };
