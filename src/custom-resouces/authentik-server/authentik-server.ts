import { createCustomResourceDefinition } from '../../services/custom-resources/custom-resources.ts';
import { GROUP } from '../../utils/consts.ts';

import { authentikServerSpecSchema } from './authentik-server.schemas.ts';
import { AuthentikServerController } from './authentik-server.controller.ts';

const authentikServerDefinition = createCustomResourceDefinition({
  group: GROUP,
  version: 'v1',
  kind: 'AuthentikServer',
  names: {
    plural: 'authentikservers',
    singular: 'authentikserver',
  },
  spec: authentikServerSpecSchema,
  create: (options) => new AuthentikServerController(options),
});

export { authentikServerDefinition };
