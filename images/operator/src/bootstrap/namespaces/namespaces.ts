import type { Services } from '../../utils/service.ts';
import { ResourceService } from '../../services/resources/resources.ts';

import { Namespace } from '#resources/core/namespace/namespace.ts';

class NamespaceService {
  #homelab: Namespace;
  #istioSystem: Namespace;
  #certManager: Namespace;

  constructor(services: Services) {
    const resourceService = services.get(ResourceService);
    this.#homelab = resourceService.get(Namespace, 'homelab');
    this.#istioSystem = resourceService.get(Namespace, 'istio-system');
    this.#certManager = resourceService.get(Namespace, 'cert-manager');

    this.#homelab.on('changed', this.ensure);
    this.#istioSystem.on('changed', this.ensure);
    this.#certManager.on('changed', this.ensure);
  }

  public get homelab() {
    return this.#homelab;
  }
  public get istioSystem() {
    return this.#istioSystem;
  }
  public get certManager() {
    return this.#certManager;
  }

  public ensure = async () => {
    await this.#homelab.ensure({
      metadata: {
        labels: {
          'istio-injection': 'enabled',
        },
      },
    });
    await this.#istioSystem.ensure({});
    await this.#certManager.ensure({});
  };
}

export { NamespaceService };
