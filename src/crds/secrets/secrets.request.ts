import { z } from 'zod';

import { CustomResource, type CustomResourceHandlerOptions } from '../../custom-resource/custom-resource.base.ts';

const stringValueSchema = z.object({
  key: z.string(),
  chars: z.string().optional(),
  length: z.number().optional(),
  encoding: z.enum(['utf-8', 'base64', 'base64url', 'hex']).optional(),
  value: z.string().optional(),
});

const secretRequestSpec = z.object({
  secretName: z.string().optional(),
  data: z.array(stringValueSchema),
});

class SecretRequest extends CustomResource<typeof secretRequestSpec> {
  constructor() {
    super({
      kind: 'SecretRequest',
      spec: secretRequestSpec,
      names: {
        plural: 'secretrequests',
        singular: 'secretrequest',
      },
    });
  }

  public update = async (options: CustomResourceHandlerOptions<typeof secretRequestSpec>) => {
    const { request, ensureSecret } = options;
    const { secretName = request.metadata.name } = request.spec;
    const { namespace = request.metadata.namespace ?? 'default' } = request.metadata;
    await ensureSecret({
      name: secretName,
      namespace,
      schema: z.object({}).passthrough(),
      generator: async () => ({
        hello: 'world',
      }),
    });
  };
}

export { SecretRequest };
