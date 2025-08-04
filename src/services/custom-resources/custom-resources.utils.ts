import { z } from 'zod';

import { customResourceStatusSchema, type CustomResourceDefinition } from './custom-resources.types.ts';

const createManifest = (defintion: CustomResourceDefinition<ExpectedAny>) => {
  return {
    apiVersion: 'apiextensions.k8s.io/v1',
    kind: 'CustomResourceDefinition',
    metadata: {
      name: `${defintion.names.plural}.${defintion.group}`,
    },
    spec: {
      group: defintion.group,
      names: {
        kind: defintion.kind,
        plural: defintion.names.plural,
        singular: defintion.names.singular,
      },
      scope: 'Namespaced',
      versions: [
        {
          name: defintion.version,
          served: true,
          storage: true,
          schema: {
            openAPIV3Schema: {
              type: 'object',
              properties: {
                spec: {
                  ...z.toJSONSchema(defintion.spec.strict(), { io: 'input' }),
                  $schema: undefined,
                  additionalProperties: undefined,
                } as ExpectedAny,
                status: {
                  ...z.toJSONSchema(customResourceStatusSchema.strict(), { io: 'input' }),
                  $schema: undefined,
                  additionalProperties: undefined,
                } as ExpectedAny,
              },
            },
          },
          subresources: {
            status: {},
          },
        },
      ],
    },
  };
};

export { createManifest };
