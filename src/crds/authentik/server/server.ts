import { createCustomResource } from '../../../custom-resource/custom-resource.base.ts';

import { authentikServerSpecSchema } from './server.schema.ts';
import { setupAuthentik } from './server.setup.ts';

const AuthentikServer = createCustomResource({
  kind: 'AuthentikServer',
  names: {
    plural: 'authentikservers',
    singular: 'authentikserver',
  },
  spec: authentikServerSpecSchema,
  update: async (options) => {
    await setupAuthentik(options);
  },
});

export { AuthentikServer };
