import type { httpServiceSpecSchema } from '../custom-resouces/http-service/http-service.schemas.ts';
import type { CustomResourceObject } from '../services/custom-resources/custom-resources.custom-resource.ts';
import { ResourceInstance } from '../services/resources/resources.instance.ts';

class HttpServiceInstance extends ResourceInstance<CustomResourceObject<typeof httpServiceSpecSchema>> {}

export { HttpServiceInstance };
