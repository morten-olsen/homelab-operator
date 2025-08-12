import type { V1Deployment } from '@kubernetes/client-node';

import { ResourceInstance } from '../services/resources/resources.ts';

class DeploymentInstance extends ResourceInstance<V1Deployment> {
  public get ready() {
    return this.exists && this.status?.readyReplicas === this.status?.replicas;
  }
}

export { DeploymentInstance };
