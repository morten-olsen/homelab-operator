import { V1PersistentVolume, type V1PersistentVolumeClaim, CoreV1Event, V1StorageClass } from '@kubernetes/client-node';

import { Watcher, WatcherService } from '../services/watchers/watchers.ts';
import type { Services } from '../utils/service.ts';
import { ResourceService, type Resource } from '../services/resources/resources.ts';

const PROVISIONER = 'homelab-operator-local-path';

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
    try {
      if (!pvc.exists || pvc.metadata?.deletionTimestamp) {
        return;
      }

      const storageClassName = pvc.spec?.storageClassName;
      if (!storageClassName) {
        return;
      }
      const resourceService = this.#services.get(ResourceService);
      const storageClass = resourceService.get<V1StorageClass>({
        apiVersion: 'storage.k8s.io/v1',
        kind: 'StorageClass',
        name: storageClassName,
      });

      if (!storageClass.exists || storageClass.manifest?.provisioner !== PROVISIONER) {
        return;
      }

      if (pvc.status?.phase === 'Pending' && !pvc.spec?.volumeName) {
        await this.#provisionVolume(pvc, storageClass);
      }
    } catch (error) {
      console.error(`Error handling PVC ${pvc.namespace}/${pvc.name}:`, error);
      await this.#createEvent(pvc, 'Warning', 'ProvisioningFailed', `Failed to provision volume: ${error}`);
    }
  };

  #provisionVolume = async (pvc: Resource<V1PersistentVolumeClaim>, storageClass: Resource<V1StorageClass>) => {
    const pvName = `pv-${pvc.namespace}-${pvc.name}`;
    const storageLocation = storageClass.manifest?.parameters?.storageLocation || '/data/volumes';
    const target = `${storageLocation}/${pvc.namespace}/${pvc.name}`;

    try {
      const resourceService = this.#services.get(ResourceService);
      const pv = resourceService.get<V1PersistentVolume>({
        apiVersion: 'v1',
        kind: 'PersistentVolume',
        name: pvName,
      });

      await pv.patch({
        metadata: {
          name: pvName,
          labels: {
            provisioner: PROVISIONER,
            'pvc-namespace': pvc.namespace || 'default',
            'pvc-name': pvc.name || 'unknown',
          },
          annotations: {
            'pv.kubernetes.io/provisioned-by': PROVISIONER,
          },
        },
        spec: {
          hostPath: {
            path: target,
            type: 'DirectoryOrCreate',
          },
          capacity: {
            storage: pvc.spec?.resources?.requests?.storage ?? '1Gi',
          },
          persistentVolumeReclaimPolicy: 'Retain',
          accessModes: pvc.spec?.accessModes ?? ['ReadWriteOnce'],
          storageClassName: pvc.spec?.storageClassName,
          claimRef: {
            uid: pvc.metadata?.uid,
            resourceVersion: pvc.metadata?.resourceVersion,
            apiVersion: pvc.apiVersion,
            kind: 'PersistentVolumeClaim',
            name: pvc.name,
            namespace: pvc.namespace,
          },
        },
      });

      await this.#createEvent(pvc, 'Normal', 'Provisioning', `Successfully provisioned volume ${pvName}`);
    } catch (error) {
      console.error(`Failed to provision volume for PVC ${pvc.namespace}/${pvc.name}:`, error);
      throw error;
    }
  };

  #createEvent = async (pvc: Resource<V1PersistentVolumeClaim>, type: string, reason: string, message: string) => {
    try {
      const resourceService = this.#services.get(ResourceService);
      const event = resourceService.get<CoreV1Event>({
        apiVersion: 'v1',
        kind: 'Event',
        name: `${pvc.name}-${Date.now()}`,
        namespace: pvc.namespace,
      });

      if (!pvc.name || !pvc.namespace || !pvc.metadata?.uid) {
        console.error('Missing required PVC metadata for event creation');
        return;
      }

      await event.patch({
        metadata: {
          namespace: pvc.namespace,
        },
        involvedObject: {
          apiVersion: pvc.apiVersion,
          kind: 'PersistentVolumeClaim',
          name: pvc.name,
          namespace: pvc.namespace,
          uid: pvc.metadata.uid,
        },
        type,
        reason,
        message,
        source: {
          component: PROVISIONER,
        },
        firstTimestamp: new Date(),
        lastTimestamp: new Date(),
        count: 1,
      });
    } catch (error) {
      console.error(`Failed to create event for PVC ${pvc.namespace}/${pvc.name}:`, error);
    }
  };

  public start = async () => {
    await this.#watcher.start();
  };
}

export { StorageProvider, PROVISIONER };
