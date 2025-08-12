import type { KubernetesObject } from '@kubernetes/client-node';

import { ResourceInstance } from '../services/resources/resources.instance.ts';
import type { K8SGatewayV1 } from '../__generated__/resources/K8SGatewayV1.ts';

class GatewayInstance extends ResourceInstance<KubernetesObject & K8SGatewayV1> {}

export { GatewayInstance };
