import { createCustomResourceDefinition } from '../../services/custom-resources/custom-resources.ts';
import { GROUP } from '../../utils/consts.ts';

import { postgresDatabaseSpecSchema } from './portgres-database.schemas.ts';
import { PostgresDatabaseResource } from './postgres-database.resource.ts';

const postgresDatabaseDefinition = createCustomResourceDefinition({
  group: GROUP,
  version: 'v1',
  kind: 'PostgresDatabase',
  names: {
    plural: 'postgresdatabases',
    singular: 'postgresdatabase',
  },
  spec: postgresDatabaseSpecSchema,
  create: (options) => new PostgresDatabaseResource(options),
});

export { postgresDatabaseDefinition };
