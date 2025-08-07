import { createCustomResourceDefinition } from '../../services/custom-resources/custom-resources.ts';
import { GROUP } from '../../utils/consts.ts';

import { GenerateSecretResource } from './generate-secret.resource.ts';
import { generateSecretSpecSchema } from './generate-secret.schemas.ts';

const generateSecretDefinition = createCustomResourceDefinition({
  group: GROUP,
  version: 'v1',
  kind: 'GenerateSecret',
  names: {
    plural: 'generate-secrets',
    singular: 'generate-secret',
  },
  spec: generateSecretSpecSchema,
  create: (options) => new GenerateSecretResource(options),
});

export { generateSecretDefinition };
