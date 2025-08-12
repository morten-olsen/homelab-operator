import { createCustomResourceDefinition } from '../../services/custom-resources/custom-resources.ts';
import { GROUP } from '../../utils/consts.ts';

import { PostgresClusterController } from './postgres-cluster.controller.ts';
import { postgresClusterSpecSchema } from './postgres-cluster.schemas.ts';

const postgresClusterDefinition = createCustomResourceDefinition({
  group: GROUP,
  version: 'v1',
  kind: 'PostgresCluster',
  names: {
    plural: 'postgres-clusters',
    singular: 'postgres-cluster',
  },
  spec: postgresClusterSpecSchema,
  create: (options) => new PostgresClusterController(options),
});

export { postgresClusterDefinition };
