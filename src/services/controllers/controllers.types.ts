import type { z, ZodAny, ZodType } from 'zod';
import type { KubernetesObject } from '@kubernetes/client-node';

import type { Resource } from '../resources/resources.resource.ts';

import type { CustomResourceControllerDependencies } from './controllers.dependencies.ts';

type CustomResourceControllerOptions<TSpec extends ZodType> = {
  resource: Resource<KubernetesObject & { spec: z.infer<TSpec> }>;
  dependencies: CustomResourceControllerDependencies;
};

type CustomResourceController<TSpec extends ZodType> = (options: CustomResourceControllerOptions<TSpec>) => {
  reconcile: () => Promise<void>;
};

type CustomResource<TSpec extends ZodAny> = {
  group: string;
  version: string;
  spec: TSpec;
  scope: 'namespace' | 'cluster';
  controller: CustomResourceController<TSpec>;
};

export type { CustomResource, CustomResourceController };
