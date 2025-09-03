import { z } from 'zod';

import type { InstallableResourceClass } from './resources.ts';

const createManifest = (defintion: InstallableResourceClass<ExpectedAny>) => {
  const plural = defintion.plural ?? defintion.kind.toLowerCase() + 's';
  const [version, group] = defintion.apiVersion.split('/').toReversed();
  return {
    apiVersion: 'apiextensions.k8s.io/v1',
    kind: 'CustomResourceDefinition',
    metadata: {
      name: `${plural}.${group}`,
    },
    spec: {
      group: group,
      names: {
        kind: defintion.kind,
        plural: plural,
        singular: defintion.kind.toLowerCase(),
      },
      scope: defintion.scope,
      versions: [
        {
          name: version,
          served: true,
          storage: true,
          schema: {
            openAPIV3Schema: {
              type: 'object',
              properties: {
                spec: {
                  ...z.toJSONSchema(defintion.spec, { io: 'input' }),
                  $schema: undefined,
                  additionalProperties: undefined,
                } as ExpectedAny,
                status: {
                  ...z.toJSONSchema(defintion.status, { io: 'input' }),
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
