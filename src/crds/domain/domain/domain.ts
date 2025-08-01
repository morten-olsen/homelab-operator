import z from 'zod';

import { createCustomResource } from '../../../custom-resource/custom-resource.base.ts';
import { K8sService } from '../../../services/k8s.ts';
import { ConfigService } from '../../../services/config/config.ts';
import { CustomResourceRegistry } from '../../../custom-resource/custom-resource.registry.ts';
import { GROUP } from '../../../utils/consts.ts';

const Domain = createCustomResource({
  kind: 'Domain',
  names: {
    singular: 'domain',
    plural: 'domains',
  },
  spec: z.object({
    domain: z.string(),
  }),
  update: async ({ request, services }) => {
    const k8s = services.get(K8sService);
    const config = services.get(ConfigService);
    const secretName = `certificate-${request.metadata.name}`;

    request.addEvent({
      type: 'Normal',
      message: 'Creating certificate',
      reason: 'CreateCertificate',
      action: 'Create',
    });
    await k8s.upsert({
      apiVersion: 'cert-manager.io/v1',
      kind: 'Certificate',
      metadata: {
        name: request.metadata.name,
        namespace: 'istio-ingress',
      },
      spec: {
        secretName,
        dnsNames: [`*.${request.spec.domain}`],
        issuerRef: {
          name: config.certManager,
          kind: 'ClusterIssuer',
        },
      },
    });
    request.addEvent({
      type: 'Normal',
      message: 'Created certificate',
      reason: 'CreatedCertificate',
      action: 'Create',
    });

    request.addEvent({
      type: 'Normal',
      message: 'Creating gateway',
      reason: 'CreateGateway',
      action: 'Create',
    });
    await k8s.upsert({
      apiVersion: 'networking.istio.io/v1alpha3',
      kind: 'Gateway',
      metadata: {
        name: request.metadata.name,
        namespace: request.metadata.namespace,
        ownerReferences: [request.objectRef],
      },
      spec: {
        selector: {
          app: config.istio.gateway,
        },
        servers: [
          {
            port: {
              number: 80,
              name: 'http',
              protocol: 'HTTP',
            },
            hosts: [`*.${request.spec.domain}`],
            tls: {
              httpsRedirect: true,
            },
          },
          {
            port: {
              number: 443,
              name: 'https',
              protocol: 'HTTPS',
            },
            hosts: [`*.${request.spec.domain}`],
            tls: {
              mode: 'SIMPLE',
              credentialName: secretName,
            },
          },
        ],
      },
    });
    request.addEvent({
      type: 'Normal',
      message: 'Created gateway',
      reason: 'CreatedGateway',
      action: 'Create',
    });
    const registryService = services.get(CustomResourceRegistry);
    const endpoints = registryService.objects.filter(
      (obj) =>
        obj.manifest.kind === 'DomainEndpoint' &&
        obj.manifest.apiVersion === `${GROUP}/v1` &&
        obj.manifest.spec.domain === `${request.metadata.namespace}/${request.metadata.name}`,
    );
    const expectedDomainId = [request.metadata.uid, request.metadata.generation].join('.');
    for (const endpoint of endpoints) {
      const domainId = endpoint.manifest.metadata[`${GROUP}/domain-id`];
      if (domainId === expectedDomainId) {
        continue;
      }
      request.addEvent({
        type: 'Normal',
        message: `Updating dependent endpoint: ${endpoint.manifest.metadata.namespace}/${endpoint.manifest.metadata.name}`,
        reason: 'UpdateDependant',
        action: 'Update',
      });
      await endpoint.manifest.patch({
        metadata: {
          annotations: {
            [`${GROUP}/generation`]: expectedDomainId,
          },
        },
      });
    }
  },
});

export { Domain };
