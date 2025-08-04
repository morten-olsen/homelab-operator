import { z, type ZodObject } from 'zod';

import type { CustomResource, CustomResourceOptions } from './custom-resources.custom-resource.ts';

type CustomResourceDefinition<TSpec extends ZodObject> = {
  group: string;
  version: string;
  kind: string;
  names: {
    plural: string;
    singular: string;
  };
  spec: TSpec;
  create: (options: CustomResourceOptions<TSpec>) => CustomResource<TSpec>;
};

const customResourceStatusSchema = z.object({
  observedGeneration: z.number().optional(),
  conditions: z
    .array(
      z.object({
        observedGeneration: z.number().optional(),
        type: z.string(),
        status: z.enum(['True', 'False', 'Unknown']),
        lastTransitionTime: z.string().datetime(),
        resource: z.boolean().optional(),
        failed: z.boolean().optional(),
        syncing: z.boolean().optional(),
        reason: z.string().optional().optional(),
        message: z.string().optional().optional(),
      }),
    )
    .optional(),
});

type CustomResourceStatus = z.infer<typeof customResourceStatusSchema>;

export { customResourceStatusSchema, type CustomResourceDefinition, type CustomResourceStatus };
