import type { Services } from '../../utils/service.ts';

import type { AuthentikServerInfo } from './authentik.types.ts';
import { AuthentikInstance } from './authentik.instance.ts';

class AuthentikService {
  #services: Services;

  constructor(services: Services) {
    this.#services = services;
  }

  public get = async (info: AuthentikServerInfo) => {
    return new AuthentikInstance({
      info,
      services: this.#services,
    });
  };
}

export { AuthentikService };
