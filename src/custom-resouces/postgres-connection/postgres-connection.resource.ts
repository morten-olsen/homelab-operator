import type { V1Secret } from '@kubernetes/client-node';

import {
  CustomResource,
  type CustomResourceOptions,
} from '../../services/custom-resources/custom-resources.custom-resource.ts';
import { ResourceReference } from '../../services/resources/resources.ref.ts';
import { ResourceService } from '../../services/resources/resources.ts';
import { getWithNamespace } from '../../utils/naming.ts';
import { PostgresService } from '../../services/postgres/postgres.service.ts';

import type { postgresConnectionSpecSchema } from './posgtres-connection.schemas.ts';

class PostgresConnectionResource extends CustomResource<typeof postgresConnectionSpecSchema> {
  #secret: ResourceReference<V1Secret>;

  constructor(options: CustomResourceOptions<typeof postgresConnectionSpecSchema>) {
    super(options);
    const resourceService = this.services.get(ResourceService);
    const secretNames = getWithNamespace(this.spec.secret, this.namespace);
    this.#secret = new ResourceReference<V1Secret>(
      resourceService.get({
        apiVersion: 'v1',
        kind: 'Secret',
        name: secretNames.name,
        namespace: secretNames.namespace,
      }),
    );
    this.#secret.on('changed', this.queueReconcile);
  }

  public reconcile = async () => {
    const resourceService = this.services.get(ResourceService);
    const secretNames = getWithNamespace(this.spec.secret, this.namespace);
    this.#secret.current = resourceService.get({
      apiVersion: 'v1',
      kind: 'Secret',
      name: secretNames.name,
      namespace: secretNames.namespace,
    });

    const current = this.#secret.current;
    if (!current?.exists || !current.data) {
      return this.conditions.set('Ready', {
        status: 'False',
        reason: 'MissingSecret',
      });
    }
    const { host, user, password, port } = current.data;
    if (!host) {
      return this.conditions.set('Ready', {
        status: 'False',
        reason: 'MissingHost',
      });
    }
    if (!user) {
      return this.conditions.set('Ready', {
        status: 'False',
        reason: 'MissingUser',
      });
    }
    if (!password) {
      return this.conditions.set('Ready', {
        status: 'False',
        reason: 'MissingPassword',
      });
    }
    const postgresService = this.services.get(PostgresService);
    const database = postgresService.get({
      host,
      user,
      port: port ? Number(port) : 5432,
      password,
    });
    if (!(await database.ping())) {
      return this.conditions.set('Ready', {
        status: 'False',
        reason: 'CanNotConnectToDatabase',
      });
    }
    await this.conditions.set('Ready', {
      status: 'True',
    });
  };
}

export { PostgresConnectionResource };
