import type { KubernetesObject } from '@kubernetes/client-node';

import { ResourceReference } from './resources.ref.ts';

abstract class ResourceInstance<T extends KubernetesObject> extends ResourceReference<T> {
  public get resource() {
    if (!this.current) {
      throw new Error('Instance needs a resource');
    }
    return this.current;
  }

  public get manifest() {
    return this.resource.metadata;
  }

  public get apiVersion() {
    return this.resource.apiVersion;
  }

  public get kind() {
    return this.resource.kind;
  }

  public get name() {
    return this.resource.name;
  }

  public get namespace() {
    return this.resource.namespace;
  }

  public get metadata() {
    return this.resource.metadata;
  }

  public get spec() {
    return this.resource.spec;
  }

  public get data() {
    return this.resource.data;
  }

  public patch = this.resource.patch;
  public reload = this.resource.load;
  public delete = this.resource.delete;
}

export { ResourceInstance };
