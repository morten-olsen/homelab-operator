import { CustomResource, ResourceService, type CustomResourceOptions } from '#services/resources/resources.ts';
import { z } from 'zod';
import { Environment } from '../environment/environment.ts';
import { API_VERSION } from '#utils/consts.ts';

const specSchema = z.object({
  environment: z.string(),
  subdomain: z.string(),
  destination: z.object({
    host: z.string(),
    port: z.object({
      number: z.number(),
    }),
  }),
});

class ExternalHttpService extends CustomResource<typeof specSchema> {
  public static readonly apiVersion = API_VERSION;
  public static readonly kind = 'ExternalHttpService';
  public static readonly spec = specSchema;
  public static readonly scope = 'Namespaced';

  constructor(options: CustomResourceOptions<typeof specSchema>) {
    super(options);
  }

  public get rule() {
    if (!this.spec) {
      return undefined;
    }
    const resourceService = this.services.get(ResourceService);
    const env = resourceService.get(Environment, this.spec.environment);
    const hostname = `${this.spec.subdomain}.${env.spec?.domain}`;
    return {
      domain: env.spec?.domain,
      subdomain: this.spec.subdomain,
      hostname,
      destination: this.spec.destination,
    };
  }
}

export { ExternalHttpService };
