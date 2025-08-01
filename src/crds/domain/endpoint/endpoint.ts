import z from 'zod';

import { createCustomResource } from '../../../custom-resource/custom-resource.base.ts';
import { K8sService } from '../../../services/k8s.ts';
import { getWithNamespace } from '../../../utils/naming.ts';
import { GROUP } from '../../../utils/consts.ts';

const DomainEndpoint = createCustomResource({
  kind: 'DomainEndpoint',
  names: {
    plural: 'domainendpoints',
    singular: 'domainendpoint',
  },
  spec: z.object({
    domain: z.string(),
    subdomain: z.string(),
    destination: z.object({
      name: z.string(),
      namespace: z.string().optional(),
      port: z.object({
        number: z.number(),
      }),
    }),
  }),
  update: async ({ request, services }) => {
    const k8s = services.get(K8sService);
    const domainName = getWithNamespace(request.spec.domain);
    const domain = await k8s.get<ExpectedAny>({
      apiVersion: `${GROUP}/v1`,
      kind: 'Domain',
      name: domainName.name,
      namespace: domainName.namespace,
    });
    if (!domain) {
      throw new Error(`Domain ${request.spec.domain} could not be found`);
    }
    const host = `${request.spec.subdomain}.${domain.spec.domain}`;
    await k8s.upsert({
      apiVersion: 'networking.istio.io/v1alpha3',
      kind: 'VirtualService',
      metadata: {
        name: request.metadata.name,
        namespace: request.metadata.namespace,
        ownerReferences: [request.objectRef],
        labels: {
          app: request.spec.destination.name,
        },
        annotations: {
          [`${GROUP}/domain-id`]: [domain.metadata.uid, domain.metadata.generation].join('.'),
        },
      },
      spec: {
        hosts: [host],
        gateways: [`${domain.metadata.namespace}/${domain.metadata.name}`],
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
                  host: `${request.spec.destination.name}.${request.spec.destination.namespace || request.metadata.namespace || 'default'}.svc.cluster.local`,
                  protocol: 'HTTP',
                  port: request.spec.destination.port,
                },
              },
            ],
          },
        ],
      },
    });
  },
});

export { DomainEndpoint };
