import { createCustomResourceDefinition } from '../../services/custom-resources/custom-resources.ts';
import { GROUP } from '../../utils/consts.ts';

import { postgresConnectionSpecSchema } from './posgtres-connection.schemas.ts';
import { PostgresConnectionResource } from './postgres-connection.resource.ts';

const postgresConnectionDefinition = createCustomResourceDefinition({
  group: GROUP,
  version: 'v1',
  kind: 'PostgresConnection',
  names: {
    plural: 'postgresconnections',
    singular: 'postgresconnection',
  },
  spec: postgresConnectionSpecSchema,
  create: (options) => new PostgresConnectionResource(options),
});

export { postgresConnectionDefinition };
