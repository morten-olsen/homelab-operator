import { z, type ZodType } from 'zod';
import type { KubernetesObject } from '@kubernetes/client-node';

import { Resource, type ResourceOptions } from './resource.ts';

import { API_VERSION } from '#utils/consts.ts';

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

type CustomResourceOptions<TSpec extends ZodType> = ResourceOptions<KubernetesObject & { spec: z.infer<TSpec> }>;

class CustomResource<TSpec extends ZodType> extends Resource<KubernetesObject & { spec: z.infer<TSpec> }> {
  public static readonly apiVersion = API_VERSION;
  public static readonly status = customResourceStatusSchema;
}

export { CustomResource, type CustomResourceOptions };
