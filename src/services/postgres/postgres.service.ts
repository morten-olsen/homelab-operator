import { Services } from '../../utils/service.ts';

import { PostgresInstance, type PostgresInstanceOptions } from './postgres.instance.ts';

class PostgresService {
  #services: Services;

  constructor(services: Services) {
    this.#services = services;
  }

  public get = (options: Omit<PostgresInstanceOptions, 'services'>) => {
    return new PostgresInstance({
      ...options,
      services: this.#services,
    });
  };
}

export { PostgresService };
