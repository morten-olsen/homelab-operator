import type { environmentSpecSchema } from '../custom-resouces/environment/environment.schemas.ts';
import type { CustomResourceObject } from '../services/custom-resources/custom-resources.custom-resource.ts';
import { ResourceInstance } from '../services/resources/resources.instance.ts';

class EnvironmentInstance extends ResourceInstance<CustomResourceObject<typeof environmentSpecSchema>> {}

export { EnvironmentInstance };
