import { createCustomResourceDefinition } from '../../services/custom-resources/custom-resources.ts';
import { GROUP } from '../../utils/consts.ts';

import { postgresClusterSpecSchema } from './postgres-cluster.schemas.ts';
import { PostgresClusterResource } from './postgres-cluster.resource.ts';

const postgresClusterDefinition = createCustomResourceDefinition({
  group: GROUP,
  version: 'v1',
  kind: 'PostgresCluster',
  names: {
    plural: 'postgresclusters',
    singular: 'postgrescluster',
  },
  spec: postgresClusterSpecSchema,
  create: (options) => new PostgresClusterResource(options),
});

export { postgresClusterDefinition };
