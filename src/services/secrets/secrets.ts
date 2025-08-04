import type { ZodObject } from 'zod';

import type { Services } from '../../utils/service.ts';

import { EnsuredSecret, type EnsuredSecretOptions } from './secrets.secret.ts';

class SecretService {
  #services: Services;

  constructor(services: Services) {
    this.#services = services;
  }

  public ensure = <T extends ZodObject>(options: Omit<EnsuredSecretOptions<T>, 'services'>) => {
    return new EnsuredSecret({
      ...options,
      services: this.#services,
    });
  };
}

export { SecretService };
