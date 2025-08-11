import { mkdir } from 'fs/promises';

import { V1PersistentVolume, type V1PersistentVolumeClaim } from '@kubernetes/client-node';

import { Watcher, WatcherService } from '../services/watchers/watchers.ts';
import type { Services } from '../utils/service.ts';
import { ResourceService, type Resource } from '../services/resources/resources.ts';

const PROVISIONER = 'reuse-local-path-provisioner';

class StorageProvider {
  #watcher: Watcher<V1PersistentVolumeClaim>;
  #services: Services;

  constructor(services: Services) {
    this.#services = services;
    const watchService = this.#services.get(WatcherService);
    this.#watcher = watchService.create({
      path: '/api/v1/persistentvolumeclaims',
      transform: (manifest) => ({
        apiVersion: 'v1',
        kind: 'PersistentVolumeClaim',
        ...manifest,
      }),
      list: async (k8s) => {
        const current = await k8s.api.listPersistentVolumeClaimForAllNamespaces();
        return current;
      },
      verbs: ['add', 'update', 'delete'],
    });
    this.#watcher.on('changed', this.#handleChange);
  }

  #handleChange = async (pvc: Resource<V1PersistentVolumeClaim>) => {
    if (pvc.metadata?.annotations?.['volume.kubernetes.io/storage-provisioner'] !== PROVISIONER) {
      return;
    }
    const target = `./data/${pvc.namespace}/${pvc.name}`;
    console.log('TARGET: ', target);
    try {
      await mkdir(target, { recursive: true });
    } catch (err) {
      console.error(err);
    }
    const resourceService = this.#services.get(ResourceService);
    const pv = resourceService.get<V1PersistentVolume>({
      apiVersion: 'v1',
      kind: 'PersistentVolume',
      name: pvc.name,
      namespace: pvc.namespace,
    });
    await pv.load();
    await pv.patch({
      metadata: {
        labels: {
          provisioner: PROVISIONER,
        },
      },
      spec: {
        hostPath: {
          path: target,
        },
        capacity: {
          storage: pvc.spec?.resources?.requests?.storage ?? '1Gi',
        },
        persistentVolumeReclaimPolicy: 'Retain',
        accessModes: pvc.spec?.accessModes,
        claimRef: {
          uid: pvc.metadata?.uid,
          resourceVersion: pvc.metadata?.resourceVersion,
          apiVersion: pvc.apiVersion,
          name: pvc.name,
          namespace: pvc.namespace,
        },
      },
    });
  };

  public start = async () => {
    await this.#watcher.start();
  };
}

export { StorageProvider };
