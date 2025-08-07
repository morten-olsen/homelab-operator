import { createCustomResourceDefinition } from '../../services/custom-resources/custom-resources.ts';
import { GROUP } from '../../utils/consts.ts';

import { RedisServerResource } from './redis-server.resource.ts';
import { redisServerSpecSchema } from './redis-server.schemas.ts';

const redisServerDefinition = createCustomResourceDefinition({
  group: GROUP,
  version: 'v1',
  kind: 'RedisServer',
  names: {
    plural: 'redis-servers',
    singular: 'redis-server',
  },
  spec: redisServerSpecSchema,
  create: (options) => new RedisServerResource(options),
});

export { redisServerDefinition };
