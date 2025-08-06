import { createCustomResourceDefinition } from '../../services/custom-resources/custom-resources.ts';
import { GROUP } from '../../utils/consts.ts';

import { HomelabResource } from './homelab.resource.ts';
import { homelabSpecSchema } from './homelab.schemas.ts';

const homelabDefinition = createCustomResourceDefinition({
  group: GROUP,
  version: 'v1',
  kind: 'Homelab',
  names: {
    plural: 'homelabs',
    singular: 'homelab',
  },
  spec: homelabSpecSchema,
  create: (options) => new HomelabResource(options),
});

export { homelabDefinition };
