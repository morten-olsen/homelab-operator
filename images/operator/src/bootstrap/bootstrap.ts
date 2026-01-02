import { CloudflareTunnel } from '#resources/homelab/cloudflare-tunnel/cloudflare-tunnel.ts';
import { ResourceService } from '#services/resources/resources.ts';
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

  public get cloudflareTunnel() {
    const resourceService = this.#services.get(ResourceService);
    return resourceService.get(CloudflareTunnel, 'cloudflare-tunnel', this.namespaces.homelab.name);
  }

  public ensure = async () => {
    await this.namespaces.ensure();
    // await this.repos.ensure();
    // await this.releases.ensure();
    // await this.cloudflareTunnel.ensure({
    //  spec: {},
    //});
  };
}

export { BootstrapService };
