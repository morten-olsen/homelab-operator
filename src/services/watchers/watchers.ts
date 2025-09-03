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
}

export { WatcherService, Watcher };
