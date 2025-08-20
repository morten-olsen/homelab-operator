import { z, type ZodType } from 'zod';
import { type KubernetesObject } from '@kubernetes/client-node';

import { Resource, type ResourceOptions } from './resource.ts';

import { API_VERSION } from '#utils/consts.ts';
import { CoalescingQueued } from '#utils/queues.ts';
import { NotReadyError } from '#utils/errors.ts';

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

class CustomResource<TSpec extends ZodType> extends Resource<
  KubernetesObject & { spec: z.infer<TSpec>; status?: z.infer<typeof customResourceStatusSchema> }
> {
  public static readonly apiVersion = API_VERSION;
  public static readonly status = customResourceStatusSchema;

  #reconcileQueue: CoalescingQueued<void>;

  constructor(options: CustomResourceOptions<TSpec>) {
    super(options);
    this.#reconcileQueue = new CoalescingQueued({
      action: async () => {
        try {
          if (!this.exists || !this.manifest?.metadata?.deletionTimestamp) {
            return;
          }
          this.services.log.debug('Reconciling', {
            apiVersion: this.apiVersion,
            kind: this.kind,
            namespace: this.namespace,
            name: this.name,
          });
          await this.reconcile?.();
        } catch (err) {
          if (err instanceof NotReadyError) {
            console.error(err);
          } else {
            throw err;
          }
        }
      },
    });
    this.on('changed', this.#handleUpdate);
  }

  public get isSeen() {
    return this.metadata?.generation === this.status?.observedGeneration;
  }

  #handleUpdate = async () => {
    if (this.isSeen) {
      return;
    }
    return await this.queueReconcile();
  };

  public reconcile?: () => Promise<void>;
  public queueReconcile = () => {
    return this.#reconcileQueue.run();
  };

  public markSeen = async () => {
    if (this.isSeen) {
      return;
    }
    await this.patchStatus({
      observedGeneration: this.metadata?.generation,
    });
  };

  public patchStatus = async (status: Partial<z.infer<typeof customResourceStatusSchema>>) => {
    this.patch({ status } as ExpectedAny);
  };
}

export { CustomResource, type CustomResourceOptions };
