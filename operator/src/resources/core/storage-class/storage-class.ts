import type { V1StorageClass } from '@kubernetes/client-node';

import { Resource } from '#services/resources/resources.ts';

class StorageClass extends Resource<V1StorageClass> {
  public static readonly apiVersion = 'storage.k8s.io/v1';
  public static readonly kind = 'StorageClass';
  public static readonly plural = 'storageclasses';
}

export { StorageClass };
