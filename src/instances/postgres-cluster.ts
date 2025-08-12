import type { postgresClusterSpecSchema } from '../custom-resouces/postgres-cluster/postgres-cluster.schemas.ts';
import type { CustomResourceObject } from '../services/custom-resources/custom-resources.custom-resource.ts';
import { ResourceInstance } from '../services/resources/resources.instance.ts';

class PostgresClusterInstance extends ResourceInstance<CustomResourceObject<typeof postgresClusterSpecSchema>> {}

export { PostgresClusterInstance };
