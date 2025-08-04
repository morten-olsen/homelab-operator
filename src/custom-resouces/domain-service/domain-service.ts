import { createCustomResourceDefinition } from '../../services/custom-resources/custom-resources.ts';
import { GROUP } from '../../utils/consts.ts';

import { DomainServiceResource } from './domain-service.resource.ts';
import { domainServiceSpecSchema } from './domain-service.schemas.ts';

const domainServiceDefinition = createCustomResourceDefinition({
  group: GROUP,
  kind: 'DomainService',
  version: 'v1',
  spec: domainServiceSpecSchema,
  names: {
    plural: 'domainservices',
    singular: 'domainservice',
  },
  create: (options) => new DomainServiceResource(options),
});

export { domainServiceDefinition };
