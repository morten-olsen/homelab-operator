import type { V1Deployment } from '@kubernetes/client-node';

import type { Services } from '../../utils/service.ts';
import { ResourceReference } from '../resources/resources.ref.ts';
import type { Watcher } from '../watchers/watchers.watcher.ts';
import { WatcherService } from '../watchers/watchers.ts';
import type { Resource } from '../resources/resources.ts';

const ISTIO_APP_SELECTOR = 'istio=gateway-controller';

class IstioService {
  #gatewayResource: ResourceReference<V1Deployment>;
  #gatewayWatcher: Watcher<V1Deployment>;

  constructor(services: Services) {
    this.#gatewayResource = new ResourceReference<V1Deployment>();
    const watcherService = services.get(WatcherService);
    this.#gatewayWatcher = watcherService.create({
      path: '/apis/apps/v1/deployments',
      list: async (k8s) => {
        return await k8s.apps.listDeploymentForAllNamespaces({
          labelSelector: ISTIO_APP_SELECTOR,
        });
      },
      transform: (manifest) => ({
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        ...manifest,
      }),
      verbs: ['add', 'update', 'delete'],
    });
    this.#gatewayWatcher.on('changed', this.#handleChange);
  }

  #handleChange = (resource: Resource<V1Deployment>) => {
    this.#gatewayResource.current = resource;
  };

  public get gateway() {
    return this.#gatewayResource;
  }

  public start = async () => {
    await this.#gatewayWatcher.start();
  };
}

export { IstioService };
