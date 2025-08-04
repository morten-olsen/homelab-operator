import { createCustomResourceDefinition } from '../../services/custom-resources/custom-resources.ts';
import { GROUP } from '../../utils/consts.ts';

import { redisConnectionSpecSchema } from './redis-connection.schemas.ts';
import { RedisConnectionResource } from './redis-connection.resource.ts';

const redisConnectionDefinition = createCustomResourceDefinition({
  group: GROUP,
  version: 'v1',
  kind: 'RedisConnection',
  names: {
    plural: 'redisconnections',
    singular: 'redisconnection',
  },
  spec: redisConnectionSpecSchema,
  create: (options) => new RedisConnectionResource(options),
});

export { redisConnectionDefinition };
