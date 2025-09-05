import type { V1PersistentVolume } from '@kubernetes/client-node';

import { Resource } from '#services/resources/resources.ts';

class PersistentVolume extends Resource<V1PersistentVolume> {
  public static readonly apiVersion = 'v1';
  public static readonly kind = 'PersistentVolume';
}

export { PersistentVolume };
