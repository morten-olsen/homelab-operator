import type { KubernetesObject } from '@kubernetes/client-node';

import { ResourceInstance } from '../services/resources/resources.ts';
import type { K8SGitRepositoryV1 } from '../__generated__/resources/K8SGitRepositoryV1.ts';

class GitRepoInstance extends ResourceInstance<KubernetesObject & K8SGitRepositoryV1> {
  public get ready() {
    return this.exists;
  }
}

export { GitRepoInstance };
