import { SubModeEnum } from '@goauthentik/api';
import { z } from 'zod';

import { CustomResource, type CustomResourceHandlerOptions } from '../../../custom-resource/custom-resource.base.ts';
import { AuthentikService } from '../../../services/authentik/authentik.service.ts';
import { K8sService } from '../../../services/k8s.ts';
import { GROUP } from '../../../utils/consts.ts';

const authentikClientSpec = z.object({
  authentik: z.object({
    name: z.string(),
    namespace: z.string().optional(),
  }),
  subMode: z.enum(SubModeEnum).optional(),
  clientType: z.enum(['confidential', 'public']).optional(),
  redirectUris: z.array(
    z.object({
      url: z.string(),
      matchingMode: z.enum(['strict', 'regex']),
    }),
  ),
});
const authentikClientSecret = z.object({
  clientSecret: z.string(),
});

class AuthentikClient extends CustomResource<typeof authentikClientSpec> {
  constructor() {
    super({
      kind: 'AuthentikClient',
      names: {
        singular: 'authentikclient',
        plural: 'authentikclients',
      },
      spec: authentikClientSpec,
    });
  }

  public update = async (options: CustomResourceHandlerOptions<typeof authentikClientSpec>) => {
    const { request, services, ensureSecret } = options;
    const k8s = services.get(K8sService);
    const { spec } = request;

    const serverNamespace = spec.authentik.namespace ?? request.metadata.namespace ?? 'default';

    const server = await k8s.get<ExpectedAny>({
      apiVersion: `${GROUP}/v1`,
      kind: 'AuthentikServer',
      namespace: serverNamespace,
      name: spec.authentik.name,
    });

    if (!server) {
      throw new Error(`AuthentikServer ${spec.authentik.name} not found in namespace ${serverNamespace}`);
    }

    const serverSecret = await k8s.getSecret<{
      token: string;
    }>(spec.authentik.name, spec.authentik.namespace);
    if (!serverSecret) {
      throw new Error(
        `Secret for AuthentikServer ${spec.authentik.name} not found in namespace ${spec.authentik.namespace}`,
      );
    }

    const domainNamespace = server.spec.domain.namespace || server.metadata.namespace || 'default';

    const domain = await k8s.get<ExpectedAny>({
      apiVersion: `${GROUP}/v1`,
      kind: 'Domain',
      name: server.spec.domain.name,
      namespace: domainNamespace,
    });

    if (!domain) {
      throw new Error(`Domain ${server.spec.domain.name} not found in namespace ${domainNamespace}`);
    }

    const internalUrl = `http://${server.metadata.name}.${spec.authentik.namespace || 'default'}.svc.cluster.local:9000`;
    const externalUrl = `https://${server.spec.subdomain}.${domain.spec.domain}`;
    const authentikService = services.get(AuthentikService);
    const { clientSecret } = await ensureSecret({
      name: `authentik-client-${request.metadata.name}`,
      namespace: request.metadata.namespace ?? 'default',
      schema: authentikClientSecret,
      generator: async () => ({
        clientSecret: crypto.randomUUID(),
      }),
    });
    const authentik = await authentikService.get({
      url: {
        internal: internalUrl,
        external: externalUrl,
      },
      token: serverSecret.token,
    });
    const client = await authentik.upsertClient({
      name: request.metadata.name,
      secret: clientSecret,
      subMode: request.spec.subMode,
      clientType: request.spec.clientType,
      redirectUris: request.spec.redirectUris.map((rule) => ({
        url: rule.url,
        matchingMode: rule.matchingMode ?? 'strict',
      })),
    });
    console.log(client.config);
  };
}

export { AuthentikClient };
