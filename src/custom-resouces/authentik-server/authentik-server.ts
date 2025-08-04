import { createCustomResourceDefinition } from '../../services/custom-resources/custom-resources.ts';
import { GROUP } from '../../utils/consts.ts';

import { AuthentikServerResource } from './authentik-server.resource.ts';
import { authentikServerSpecSchema } from './authentik-server.scemas.ts';

const authentikServerDefinition = createCustomResourceDefinition({
  group: GROUP,
  version: 'v1',
  kind: 'AuthentikServer',
  names: {
    plural: 'authentikservers',
    singular: 'authentikserver',
  },
  spec: authentikServerSpecSchema,
  create: (options) => new AuthentikServerResource(options),
});

export { authentikServerDefinition };
