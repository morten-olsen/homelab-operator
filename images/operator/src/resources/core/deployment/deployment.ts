import type { V1Deployment } from '@kubernetes/client-node';

import { Resource } from '#services/resources/resources.ts';

class Deployment extends Resource<V1Deployment> {
  public static readonly apiVersion = 'apps/v1';
  public static readonly kind = 'Deployment';
}

export { Deployment };
