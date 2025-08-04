import { createCustomResourceDefinition } from '../../services/custom-resources/custom-resources.ts';
import { GROUP } from '../../utils/consts.ts';

import { DomainResource } from './domain.resource.ts';
import { domainSpecSchema } from './domain.schemas.ts';

const domainDefinition = createCustomResourceDefinition({
  version: 'v1',
  kind: 'Domain',
  group: GROUP,
  names: {
    plural: 'domains',
    singular: 'domain',
  },
  spec: domainSpecSchema,
  create: (options) => new DomainResource(options),
});

export { domainDefinition };
