import { createCustomResourceDefinition } from '../../services/custom-resources/custom-resources.ts';
import { GROUP } from '../../utils/consts.ts';

import { EnvironmentController } from './environment.controller.ts';
import { environmentSpecSchema } from './environment.schemas.ts';

const environmentDefinition = createCustomResourceDefinition({
  group: GROUP,
  version: 'v1',
  kind: 'Environment',
  names: {
    plural: 'environments',
    singular: 'environment',
  },
  spec: environmentSpecSchema,
  create: (options) => new EnvironmentController(options),
});

export { environmentDefinition };
