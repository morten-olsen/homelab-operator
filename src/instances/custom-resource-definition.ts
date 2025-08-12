import type { V1CustomResourceDefinition } from '@kubernetes/client-node';

import { ResourceInstance } from '../services/resources/resources.instance.ts';

class CustomDefinitionInstance extends ResourceInstance<V1CustomResourceDefinition> {}

export { CustomDefinitionInstance };
