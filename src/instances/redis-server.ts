import type { CustomResourceObject } from '../services/custom-resources/custom-resources.custom-resource.ts';
import { ResourceInstance } from '../services/resources/resources.instance.ts';
import type { redisServerSpecSchema } from '../custom-resouces/redis-server/redis-server.schemas.ts';

class RedisServerInstance extends ResourceInstance<CustomResourceObject<typeof redisServerSpecSchema>> {}

export { RedisServerInstance };
