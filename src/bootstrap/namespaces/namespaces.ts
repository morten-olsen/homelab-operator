import { NamespaceInstance } from '../../instances/namespace.ts';
import type { Services } from '../../utils/service.ts';
import { ResourceService } from '../../services/resources/resources.ts';

class NamespaceService {
  #homelab: NamespaceInstance;
  #istioSystem: NamespaceInstance;
  #certManager: NamespaceInstance;

  constructor(services: Services) {
    const resourceService = services.get(ResourceService);
    this.#homelab = resourceService.getInstance(
      {
        apiVersion: 'v1',
        kind: 'Namespace',
        name: 'homelab',
      },
      NamespaceInstance,
    );
    this.#istioSystem = resourceService.getInstance(
      {
        apiVersion: 'v1',
        kind: 'Namespace',
        name: 'istio-system',
      },
      NamespaceInstance,
    );
    this.#certManager = resourceService.getInstance(
      {
        apiVersion: 'v1',
        kind: 'Namespace',
        name: 'cert-manager',
      },
      NamespaceInstance,
    );
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
