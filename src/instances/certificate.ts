import type { KubernetesObject } from '@kubernetes/client-node';

import { ResourceInstance } from '../services/resources/resources.instance.ts';
import type { K8SCertificateV1 } from '../__generated__/resources/K8SCertificateV1.ts';

class CertificateInstance extends ResourceInstance<KubernetesObject & K8SCertificateV1> {}

export { CertificateInstance };
