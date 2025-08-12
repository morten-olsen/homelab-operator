import { createCustomResourceDefinition } from '../../services/custom-resources/custom-resources.ts';
import { GROUP } from '../../utils/consts.ts';

import { HttpServiceController } from './http-service.controller.ts';
import { httpServiceSpecSchema } from './http-service.schemas.ts';

const httpServiceDefinition = createCustomResourceDefinition({
  group: GROUP,
  version: 'v1',
  kind: 'HttpService',
  names: {
    plural: 'httpservices',
    singular: 'httpservice',
  },
  spec: httpServiceSpecSchema,
  create: (options) => new HttpServiceController(options),
});

export { httpServiceDefinition };
