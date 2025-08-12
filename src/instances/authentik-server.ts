import type { authentikServerSpecSchema } from '../custom-resouces/authentik-server/authentik-server.schemas.ts';
import type { CustomResourceObject } from '../services/custom-resources/custom-resources.custom-resource.ts';
import { ResourceInstance } from '../services/resources/resources.instance.ts';

class AuthentikServerInstance extends ResourceInstance<CustomResourceObject<typeof authentikServerSpecSchema>> {}

export { AuthentikServerInstance };
