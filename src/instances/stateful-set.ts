import type { V1StatefulSet } from '@kubernetes/client-node';

import { ResourceInstance } from '../services/resources/resources.instance.ts';

class StatefulSetInstance extends ResourceInstance<V1StatefulSet> {
  public get ready() {
    return this.exists && this.manifest?.status?.readyReplicas === this.manifest?.status?.replicas;
  }
}

export { StatefulSetInstance };
