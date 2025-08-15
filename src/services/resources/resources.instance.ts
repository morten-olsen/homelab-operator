import type { KubernetesObject } from '@kubernetes/client-node';

import { isDeepSubset } from '../../utils/objects.ts';

import { ResourceReference } from './resources.ref.ts';

abstract class ResourceInstance<T extends KubernetesObject> extends ResourceReference<T> {
  public get resource() {
    if (!this.current) {
      throw new Error('Instance needs a resource');
    }
    return this.current;
  }

  public get services() {
    return this.resource.services;
  }

  public get exists() {
    return this.resource.exists;
  }

  public get manifest() {
    return this.resource.manifest;
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

  public get status() {
    return this.resource.status;
  }

  public patch = this.resource.patch;
  public reload = this.resource.load;
  public delete = this.resource.delete;

  public ensure = async (manifest: T) => {
    if (isDeepSubset(this.manifest, manifest)) {
      return false;
    }
    await this.patch(manifest);
    return true;
  };

  public get ready() {
    return this.exists;
  }

  public getCondition = (
    condition: string,
  ): T extends { status?: { conditions?: (infer U)[] } } ? U | undefined : undefined => {
    const status = this.status as ExpectedAny;
    return status?.conditions?.find((c: ExpectedAny) => c?.type === condition);
  };
}

export { ResourceInstance };
