import type { Services } from '../../utils/service.ts';

import { ValueReference } from './value-reference.instance.ts';

class ValueReferenceService {
  #services: Services;

  constructor(services: Services) {
    this.#services = services;
  }

  public get = (namespace: string) => {
    return new ValueReference({
      namespace,
      services: this.#services,
    });
  };
}

export * from './value-reference.instance.ts';
export { ValueReferenceService };
