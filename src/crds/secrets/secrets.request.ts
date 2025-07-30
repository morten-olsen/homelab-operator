import { Type } from '@sinclair/typebox';

import { CustomResource, type CustomResourceHandlerOptions } from '../../custom-resource/custom-resource.base.ts';

const stringValueSchema = Type.Object({
  key: Type.String(),
  chars: Type.Optional(Type.String()),
  length: Type.Optional(Type.Number()),
  encoding: Type.Optional(
    Type.String({
      enum: ['utf-8', 'base64', 'base64url', 'hex'],
    }),
  ),
  value: Type.Optional(Type.String()),
});

const secretRequestSpec = Type.Object({
  secretName: Type.Optional(Type.String()),
  data: Type.Array(stringValueSchema),
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
      schema: Type.Object({}, { additionalProperties: true }),
      generator: async () => ({
        hello: 'world',
      }),
    });
  };
}

export { SecretRequest };
