import type { KubernetesObject } from '@kubernetes/client-node';

import type { Services } from '../../utils/service.ts';

import { Resource } from './resources.resource.ts';

type ResourceGetOptions = {
  apiVersion: string;
  kind: string;
  name: string;
  namespace?: string;
};

class ResourceService {
  #cache: Resource<ExpectedAny>[] = [];
  #services: Services;

  constructor(services: Services) {
    this.#services = services;
  }

  public get = <T extends KubernetesObject>(options: ResourceGetOptions) => {
    const { apiVersion, kind, name, namespace } = options;
    let resource = this.#cache.find(
      (resource) =>
        resource.specifier.kind === kind &&
        resource.specifier.apiVersion === apiVersion &&
        resource.specifier.name === name &&
        resource.specifier.namespace === namespace,
    );
    if (resource) {
      return resource as Resource<T>;
    }
    resource = new Resource({
      data: options,
      services: this.#services,
    });
    this.#cache.push(resource);
    return resource as Resource<T>;
  };
}

export { ResourceReference } from './resources.ref.ts';
export { ResourceService, Resource };
