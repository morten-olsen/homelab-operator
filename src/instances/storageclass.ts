import type { V1StorageClass } from '@kubernetes/client-node';

import { ResourceInstance } from '../services/resources/resources.instance.ts';

class StorageClassInstance extends ResourceInstance<V1StorageClass> {}

export { StorageClassInstance };
