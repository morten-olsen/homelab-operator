import {
  authentikServerSecretSchema,
  type authentikServerSpecSchema,
} from '../custom-resouces/authentik-server/authentik-server.schemas.ts';
import type { CustomResourceObject } from '../services/custom-resources/custom-resources.custom-resource.ts';
import { ResourceInstance } from '../services/resources/resources.instance.ts';
import { ResourceService } from '../services/resources/resources.ts';

import { SecretInstance } from './secret.ts';

class AuthentikServerInstance extends ResourceInstance<CustomResourceObject<typeof authentikServerSpecSchema>> {
  public get secret() {
    const resourceService = this.services.get(ResourceService);
    return resourceService.getInstance(
      {
        apiVersion: 'v1',
        kind: 'Secret',
        name: `${this.name}-server`,
        namespace: this.namespace,
      },
      SecretInstance<typeof authentikServerSecretSchema>,
    );
  }
}

export { AuthentikServerInstance };
