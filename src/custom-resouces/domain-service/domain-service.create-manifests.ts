import type { KubernetesObject } from '@kubernetes/client-node';

import type { K8SVirtualServiceV1 } from '../../__generated__/resources/K8SVirtualServiceV1.ts';
import type { K8SDestinationRuleV1 } from '../../__generated__/resources/K8SDestinationRuleV1.ts';
import { CONTROLLED_LABEL } from '../../utils/consts.ts';

type CreateVirtualServiceManifestOptions = {
  name: string;
  namespace: string;
  owner: ExpectedAny;
  host: string;
  gateway: string;
  destination: {
    host: string;
    port: {
      number?: number;
      name?: string;
    };
  };
};
const createVirtualServiceManifest = (
  options: CreateVirtualServiceManifestOptions,
): KubernetesObject & K8SVirtualServiceV1 => ({
  apiVersion: 'networking.istio.io/v1',
  kind: 'VirtualService',
  metadata: {
    name: options.name,
    namespace: options.namespace,
    ownerReferences: [options.owner],
    labels: {
      ...CONTROLLED_LABEL,
    },
  },
  spec: {
    hosts: [options.host],
    gateways: [options.gateway],
    http: [
      {
        match: [
          {
            uri: {
              prefix: '/',
            },
          },
        ],
        route: [
          {
            destination: {
              host: options.destination.host,
              port: options.destination.port,
            },
          },
        ],
      },
    ],
  },
});

type CreateDestinationRuleManifestOptions = {
  name: string;
  namespace: string;
  host: string;
};
const createDestinationRuleManifest = (
  options: CreateDestinationRuleManifestOptions,
): KubernetesObject & K8SDestinationRuleV1 => ({
  apiVersion: 'networking.istio.io/v1',
  kind: 'DestinationRule',
  metadata: {
    name: options.name,
    namespace: options.namespace,
    labels: {
      ...CONTROLLED_LABEL,
    },
  },
  spec: {
    host: options.host,
    trafficPolicy: {
      tls: {
        mode: 'DISABLE',
      },
    },
  },
});

export { createVirtualServiceManifest, createDestinationRuleManifest };
