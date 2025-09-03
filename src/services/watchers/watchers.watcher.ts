import { ApiException, makeInformer, type Informer, type KubernetesObject } from '@kubernetes/client-node';
import { EventEmitter } from 'eventemitter3';

import { K8sService } from '../k8s/k8s.ts';
import type { Services } from '../../utils/service.ts';

type ResourceChangedAction = 'add' | 'update' | 'delete';

type WatcherEvents<T extends KubernetesObject> = {
  changed: (manifest: T) => void;
};

type WatcherOptions = {
  apiVersion: string;
  kind: string;
  plural?: string;
  selector?: string;
  services: Services;
  verbs: ResourceChangedAction[];
};

class Watcher<T extends KubernetesObject> extends EventEmitter<WatcherEvents<T>> {
  #options: WatcherOptions;
  #informer: Informer<T>;

  constructor(options: WatcherOptions) {
    super();
    this.#options = options;
    this.#informer = this.#setup();
  }

  #setup = () => {
    const { services, apiVersion, kind, selector } = this.#options;
    const plural = this.#options.plural ?? kind.toLowerCase() + 's';
    const [version, group] = apiVersion.split('/').toReversed();
    const k8s = services.get(K8sService);
    const path = group ? `/apis/${group}/${version}/${plural}` : `/api/${version}/${plural}`;
    const informer = makeInformer<T>(
      k8s.config,
      path,
      async () => {
        return k8s.objectsApi.list(apiVersion, kind);
      },
      selector,
    );
    informer.on('add', this.#handleResource.bind(this, 'add'));
    informer.on('update', this.#handleResource.bind(this, 'update'));
    informer.on('delete', this.#handleResource.bind(this, 'delete'));
    informer.on('error', (err) => {
      console.log('Watcher failed, will retry in 3 seconds', path, err);
      setTimeout(this.start, 3000);
    });
    return informer;
  };

  #handleResource = (action: ResourceChangedAction, manifest: T) => {
    this.emit('changed', manifest);
  };

  public stop = async () => {
    await this.#informer.stop();
  };

  public start = async () => {
    await this.#informer.start();
  };
}

export { Watcher, type WatcherOptions, type ResourceChangedAction };
