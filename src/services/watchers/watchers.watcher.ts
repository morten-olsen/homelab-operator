import {
  ApiException,
  makeInformer,
  type Informer,
  type KubernetesListObject,
  type KubernetesObject,
} from '@kubernetes/client-node';
import { EventEmitter } from 'eventemitter3';

import { K8sService } from '../k8s/k8s.ts';
import type { Services } from '../../utils/service.ts';
import { ResourceService, type Resource } from '../resources/resources.ts';

type ResourceChangedAction = 'add' | 'update' | 'delete';

type WatcherEvents<T extends KubernetesObject> = {
  changed: (resource: Resource<T>) => void;
};

type WatcherOptions<T extends KubernetesObject = KubernetesObject> = {
  path: string;
  list: (k8s: K8sService) => Promise<KubernetesListObject<T>>;
  selector?: string;
  services: Services;
  verbs: ResourceChangedAction[];
  transform?: (input: T) => T;
};

class Watcher<T extends KubernetesObject> extends EventEmitter<WatcherEvents<T>> {
  #options: WatcherOptions<T>;
  #informer: Informer<T>;

  constructor(options: WatcherOptions<T>) {
    super();
    this.#options = options;
    this.#informer = this.#setup();
  }

  #setup = () => {
    const { services, path, list, selector } = this.#options;
    const k8s = services.get(K8sService);
    const informer = makeInformer(k8s.config, path, list.bind(this, k8s), selector);
    informer.on('add', this.#handleResource.bind(this, 'add'));
    informer.on('update', this.#handleResource.bind(this, 'update'));
    informer.on('delete', this.#handleResource.bind(this, 'delete'));
    informer.on('error', (err) => {
      if (!(err instanceof ApiException && err.code === 404)) {
        console.log('Watcher failed, will retry in 3 seconds', path, err);
      }
      setTimeout(this.start, 3000);
    });
    return informer;
  };

  #handleResource = (action: ResourceChangedAction, originalManifest: T) => {
    const { services, transform } = this.#options;
    const manifest = transform ? transform(originalManifest) : originalManifest;
    const resourceService = services.get(ResourceService);
    const { apiVersion, kind, metadata = {} } = manifest;
    const { name, namespace } = metadata;
    if (!name || !apiVersion || !kind) {
      return;
    }
    const resource = resourceService.get<T>({
      apiVersion,
      kind,
      name,
      namespace,
    });

    if (action === 'delete') {
      resource.manifest = undefined;
    } else {
      resource.manifest = manifest;
    }
    this.emit('changed', resource);
  };

  public stop = async () => {
    await this.#informer.stop();
  };

  public start = async () => {
    await this.#informer.start();
  };
}

export { Watcher, type WatcherOptions, type ResourceChangedAction };
