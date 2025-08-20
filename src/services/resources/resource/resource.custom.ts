import { z, type ZodType } from 'zod';
import { PatchStrategy, setHeaderOptions, type KubernetesObject } from '@kubernetes/client-node';

import { Resource, type ResourceOptions } from './resource.ts';

import { API_VERSION } from '#utils/consts.ts';
import { CoalescingQueued } from '#utils/queues.ts';
import { NotReadyError } from '#utils/errors.ts';
import { K8sService } from '#services/k8s/k8s.ts';
import { CronJob, CronTime } from 'cron';

const customResourceStatusSchema = z.object({
  observedGeneration: z.number().optional(),
  conditions: z
    .array(
      z.object({
        observedGeneration: z.number().optional(),
        type: z.string(),
        status: z.enum(['True', 'False', 'Unknown']),
        lastTransitionTime: z.string().datetime().optional(),
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
  #cron: CronJob;

  constructor(options: CustomResourceOptions<TSpec>) {
    super(options);
    this.#reconcileQueue = new CoalescingQueued({
      action: async () => {
        try {
          if (!this.exists || this.manifest?.metadata?.deletionTimestamp) {
            return;
          }
          this.services.log.debug('Reconciling', {
            apiVersion: this.apiVersion,
            kind: this.kind,
            namespace: this.namespace,
            name: this.name,
          });
          await this.markSeen();
          await this.reconcile?.();
          await this.markReady();
        } catch (err) {
          if (err instanceof NotReadyError) {
            await this.markNotReady(err.reason, err.message);
          } else if (err instanceof Error) {
            await this.markNotReady('Failed', err.message);
          } else {
            await this.markNotReady('Failed', String(err));
          }
          console.error(err);
        }
      },
    });
    this.#cron = CronJob.from({
      cronTime: '*/2 * * * *',
      onTick: this.queueReconcile,
      start: true,
      runOnInit: true,
    });
    this.on('changed', this.#handleUpdate);
  }

  public get reconcileTime() {
    return this.#cron.cronTime.toString();
  }

  public set reconcileTime(pattern: string) {
    this.#cron.cronTime = new CronTime(pattern);
  }

  public get isSeen() {
    return this.metadata?.generation === this.status?.observedGeneration;
  }

  public get version() {
    const [, version] = this.apiVersion.split('/');
    return version;
  }

  public get group() {
    const [group] = this.apiVersion.split('/');
    return group;
  }

  public get scope() {
    if (!('scope' in this.constructor) || typeof this.constructor.scope !== 'string') {
      return;
    }
    return this.constructor.scope as 'Namespaced' | 'Cluster';
  }

  #handleUpdate = async (
    previous?: KubernetesObject & { spec: z.infer<TSpec>; status?: z.infer<typeof customResourceStatusSchema> },
  ) => {
    if (this.isSeen && previous) {
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

  public markNotReady = async (reason?: string, message?: string) => {
    await this.patchStatus({
      conditions: [
        {
          type: 'Ready',
          status: 'False',
          reason,
          message,
        },
      ],
    });
  };

  public markReady = async () => {
    await this.patchStatus({
      conditions: [
        {
          type: 'Ready',
          status: 'True',
        },
      ],
    });
  };

  public patchStatus = (status: Partial<z.infer<typeof customResourceStatusSchema>>) =>
    this.queue.add(async () => {
      const k8sService = this.services.get(K8sService);
      if (this.scope === 'Cluster') {
        await k8sService.customObjectsApi.patchClusterCustomObjectStatus(
          {
            version: this.version,
            group: this.group,
            plural: this.plural,
            name: this.name,
            body: { status },
          },
          setHeaderOptions('Content-Type', PatchStrategy.MergePatch),
        );
      } else {
        await k8sService.customObjectsApi.patchNamespacedCustomObjectStatus(
          {
            version: this.version,
            group: this.group,
            plural: this.plural,
            name: this.name,
            namespace: this.namespace || 'default',
            body: { status },
          },
          setHeaderOptions('Content-Type', PatchStrategy.MergePatch),
        );
      }
    });
}

export { CustomResource, type CustomResourceOptions };
