import type { KubernetesObject } from '@kubernetes/client-node';

import type { Services } from '../../utils/service.ts';
import { WatcherService } from '../watchers/watchers.ts';

import type { Resource, ResourceOptions } from './resource/resource.ts';

type ResourceClass<T extends KubernetesObject> = new (options: ResourceOptions<T>) => Resource<T>;

type RegisterOptions<T extends KubernetesObject> = {
  apiVersion: string;
  kind: string;
  plural?: string;
  type: ResourceClass<T>;
};

class ResourceService {
  #services: Services;
  #registry: Map<Resource<ExpectedAny>, Resource<ExpectedAny>[]>;

  constructor(services: Services) {
    this.#services = services;
    this.#registry = new Map();
  }

  public register = async <T extends KubernetesObject>(options: RegisterOptions<T>) => {
    const watcherService = this.#services.get(WatcherService);
    const watcher = watcherService.create({});
    watcher.on('changed', (manifest) => {
      const { name, namespace } = manifest.metadata || {};
      if (!name) {
        return;
      }
      const current = this.get(options.type, name, namespace);
      current.manifest = manifest;
    });
    await watcher.start();
  };

  public get = <T extends KubernetesObject>(type: ResourceClass<T>, name: string, namespace?: string) => {};
}

export { ResourceService };
