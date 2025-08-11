import { createCustomResourceDefinition } from '../../services/custom-resources/custom-resources.ts';
import { GROUP } from '../../utils/consts.ts';

import { AuthentikConnectionResource } from './authentik-connection.resource.ts';
import { authentikConnectionSpecSchema } from './authentik-connection.schemas.ts';

const authentikConnectionDefinition = createCustomResourceDefinition({
  group: GROUP,
  version: 'v1',
  kind: 'AuthentikConnection',
  names: {
    plural: 'authentikconnections',
    singular: 'authentikconnection',
  },
  spec: authentikConnectionSpecSchema,
  create: (options) => new AuthentikConnectionResource(options),
});

export { authentikConnectionDefinition };
