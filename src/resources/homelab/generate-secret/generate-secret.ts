import { Secret } from '#resources/core/secret/secret.ts';
import { CustomResource, ResourceService, type CustomResourceOptions } from '#services/resources/resources.ts';
import { z } from 'zod';
import { generateSecrets } from './generate-secret.utils.ts';
import { API_VERSION } from '#utils/consts.ts';

const generateSecretFieldSchema = z.object({
  name: z.string(),
  value: z.string().optional(),
  encoding: z.enum(['base64', 'base64url', 'hex', 'utf8', 'numeric']).optional(),
  length: z.number().optional(),
});

const specSchema = z.object({
  fields: z.array(generateSecretFieldSchema),
});

class GenerateSecret extends CustomResource<typeof specSchema> {
  public static readonly apiVersion = API_VERSION;
  public static readonly kind = 'GenerateSecret';
  public static readonly spec = specSchema;
  public static readonly scope = 'Namespaced';

  #secret: Secret;

  constructor(options: CustomResourceOptions<typeof specSchema>) {
    super(options);

    const resourceService = this.services.get(ResourceService);

    this.#secret = resourceService.get(Secret, this.name, this.namespace);
  }

  public reconcile = async () => {
    const secrets = generateSecrets(this.spec);
    const current = this.#secret.value;

    const expected = {
      ...secrets,
      ...current,
    };

    await this.#secret.ensure(expected);
  };
}

export { GenerateSecret };
