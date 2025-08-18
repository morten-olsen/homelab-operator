import { postgresClusterSecretSchema } from '../custom-resouces/postgres-cluster/postgres-cluster.schemas.ts';
import type { postgresDatabaseSpecSchema } from '../custom-resouces/postgres-database/portgres-database.schemas.ts';
import type { CustomResourceObject } from '../services/custom-resources/custom-resources.custom-resource.ts';
import { ResourceInstance } from '../services/resources/resources.instance.ts';
import { ResourceService } from '../services/resources/resources.ts';

import { SecretInstance } from './secret.ts';

class PostgresDatabaseInstance extends ResourceInstance<CustomResourceObject<typeof postgresDatabaseSpecSchema>> {
  public get secret() {
    const resourceService = this.services.get(ResourceService);
    return resourceService.getInstance(
      {
        apiVersion: 'v1',
        kind: 'Secret',
        name: `${this.name}-postgres-database`,
        namespace: this.namespace,
      },
      SecretInstance<typeof postgresClusterSecretSchema>,
    );
  }
}

export { PostgresDatabaseInstance };
