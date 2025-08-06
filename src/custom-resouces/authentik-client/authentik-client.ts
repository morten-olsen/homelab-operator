import { createCustomResourceDefinition } from '../../services/custom-resources/custom-resources.ts';
import { GROUP } from '../../utils/consts.ts';

import { AuthentikClientResource } from './authentik-client.resource.ts';
import { authentikClientSpecSchema } from './authentik-client.schemas.ts';

const authentikClientDefinition = createCustomResourceDefinition({
  group: GROUP,
  version: 'v1',
  kind: 'AuthentikClient',
  names: {
    plural: 'authentikclients',
    singular: 'authentikclient',
  },
  create: (options) => new AuthentikClientResource(options),
  spec: authentikClientSpecSchema,
});

export { authentikClientDefinition };
