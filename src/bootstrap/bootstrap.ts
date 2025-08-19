import type { Services } from '../utils/service.ts';

import { NamespaceService } from './namespaces/namespaces.ts';
import { ReleaseService } from './releases/releases.ts';
import { RepoService } from './repos/repos.ts';

class BootstrapService {
  #services: Services;

  constructor(services: Services) {
    this.#services = services;
  }
  public get namespaces() {
    return this.#services.get(NamespaceService);
  }

  public get repos() {
    return this.#services.get(RepoService);
  }

  public get releases() {
    return this.#services.get(ReleaseService);
  }

  public ensure = async () => {
    await this.namespaces.ensure();
    await this.repos.ensure();
    await this.releases.ensure();
  };
}

export { BootstrapService };
