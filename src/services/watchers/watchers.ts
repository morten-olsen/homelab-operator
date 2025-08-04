import type { Services } from '../../utils/service.ts';

import { Watcher, type WatcherOptions } from './watchers.watcher.ts';

class WatcherService {
  #services: Services;

  constructor(services: Services) {
    this.#services = services;
  }

  public create = (options: Omit<WatcherOptions, 'services'>) => {
    const instance = new Watcher({
      ...options,
      services: this.#services,
    });
    return instance;
  };

  public watchCustomGroup = async (group: string, version: string, plurals: string[]) => {
    for (const plural of plurals) {
      await this.create({
        path: `/apis/${group}/${version}/${plural}`,
        list: async (k8s) => {
          return await k8s.customObjectsApi.listCustomObjectForAllNamespaces({
            group,
            version,
            plural,
          });
        },
        verbs: ['add', 'update', 'delete'],
      }).start();
    }
  };
}

export { WatcherService, Watcher };
