import { SubModeEnum } from '@goauthentik/api';
import { z } from 'zod';

import { CustomResource, type CustomResourceHandlerOptions } from '../../../custom-resource/custom-resource.base.ts';
import { AuthentikService } from '../../../services/authentik/authentik.service.ts';

const authentikClientSpec = z.object({
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
    const authentikService = services.get(AuthentikService);
    const { clientSecret } = await ensureSecret({
      name: `authentik-client-${request.metadata.name}`,
      namespace: request.metadata.namespace ?? 'default',
      schema: authentikClientSecret,
      generator: async () => ({
        clientSecret: crypto.randomUUID(),
      }),
    });
    const client = await authentikService.upsertClient({
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
