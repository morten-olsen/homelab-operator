import type { V1PersistentVolumeClaim } from '@kubernetes/client-node';

import { StorageClass } from '../storage-class/storage-class.ts';
import { PersistentVolume } from '../pv/pv.ts';

import { Resource, ResourceService, type ResourceOptions } from '#services/resources/resources.ts';
import { chmod, mkdir } from 'fs/promises';

const PROVISIONER = 'homelab-operator';

class PVC extends Resource<V1PersistentVolumeClaim> {
  public static readonly apiVersion = 'v1';
  public static readonly kind = 'PersistentVolumeClaim';

  constructor(options: ResourceOptions<V1PersistentVolumeClaim>) {
    super(options);
    this.on('changed', this.reconcile);
  }

  public reconcile = async () => {
    const storageClassName = this.spec?.storageClassName;
    console.log('PVC', this.name, storageClassName);
    if (!storageClassName) {
      return;
    }
    const resourceService = this.services.get(ResourceService);
    const storageClass = resourceService.get(StorageClass, storageClassName);

    if (!storageClass.exists || storageClass.manifest?.provisioner !== PROVISIONER) {
      return;
    }
    if (this.status?.phase === 'Pending' && !this.spec?.volumeName) {
      await this.#provisionVolume(storageClass);
    }
  };

  #provisionVolume = async (storageClass: StorageClass) => {
    const pvName = `pv-${this.namespace}-${this.name}`;
    const storageLocation = storageClass.manifest?.parameters?.storageLocation || '/data/volumes';
    const target = `${storageLocation}/${this.namespace}/${this.name}`;

    const resourceService = this.services.get(ResourceService);
    const pv = resourceService.get(PersistentVolume, pvName);

    try {
      await mkdir(target, { recursive: true });
    } catch (error) {
      console.error('Error creating directory', error);
    }

    await pv.ensure({
      metadata: {
        name: pvName,
        labels: {
          provisioner: PROVISIONER,
          'pvc-namespace': this.namespace || 'default',
          'pvc-name': this.name || 'unknown',
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
          storage: this.spec?.resources?.requests?.storage ?? '1Gi',
        },
        persistentVolumeReclaimPolicy: 'Retain',
        accessModes: this.spec?.accessModes ?? ['ReadWriteOnce'],
        storageClassName: this.spec?.storageClassName,
        claimRef: {
          uid: this.metadata?.uid,
          resourceVersion: this.metadata?.resourceVersion,
          apiVersion: this.apiVersion,
          kind: 'PersistentVolumeClaim',
          name: this.name,
          namespace: this.namespace,
        },
      },
    });
    try {
      await chmod(target, 0o777);
    } catch (error) {
      console.error('Error changing directory permissions', error);
    }
  };
}

export { PVC, PROVISIONER };
