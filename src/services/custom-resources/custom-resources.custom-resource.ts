import type { z, ZodObject } from 'zod';
import { ApiException, PatchStrategy, setHeaderOptions, type KubernetesObject } from '@kubernetes/client-node';
import { EventEmitter } from 'eventemitter3';

import type { Resource } from '../resources/resources.resource.ts';
import type { Services } from '../../utils/service.ts';
import { K8sService } from '../k8s/k8s.ts';
import { CoalescingQueued } from '../../utils/queues.ts';

import type { CustomResourceDefinition, CustomResourceStatus } from './custom-resources.types.ts';
import { CustomResourceConditions } from './custom-resources.conditions.ts';

type CustomResourceObject<TSpec extends ZodObject> = KubernetesObject & {
  spec: z.infer<TSpec>;
  status?: CustomResourceStatus;
};

type CustomResourceOptions<TSpec extends ZodObject> = {
  resource: Resource<CustomResourceObject<TSpec>>;
  services: Services;
  definition: CustomResourceDefinition<TSpec>;
};

type CustomResourceEvents<TSpec extends ZodObject> = {
  changed: () => void;
  changedStatus: (options: { previous: CustomResourceStatus; next: CustomResourceStatus }) => void;
  changedMetadate: (options: { previous: KubernetesObject['metadata']; next: KubernetesObject['metadata'] }) => void;
  changedSpec: (options: { previous: z.infer<TSpec>; next: z.infer<TSpec> }) => void;
};

type SubresourceResult = {
  ready: boolean;
  syncing?: boolean;
  failed?: boolean;
  reason?: string;
  message?: string;
};

abstract class CustomResource<TSpec extends ZodObject> extends EventEmitter<CustomResourceEvents<TSpec>> {
  #options: CustomResourceOptions<TSpec>;
  #conditions: CustomResourceConditions;
  #queue: CoalescingQueued<void>;

  constructor(options: CustomResourceOptions<TSpec>) {
    super();
    this.#options = options;
    this.#conditions = new CustomResourceConditions({
      resource: this,
    });
    options.resource.on('changed', this.#handleChanged);
    this.#queue = new CoalescingQueued({
      action: async () => {
        if (this.exists && !this.isValidSpec) {
          this.services.log.error(
            `Invalid spec for ${this.apiVersion}/${this.kind}/${this.namespace}/${this.name}`,
            this.spec,
          );
          return;
        }
        console.log('Reconcileing', this.apiVersion, this.kind, this.namespace, this.name);
        await this.reconcile?.();
      },
    });
  }

  public get conditions() {
    return this.#conditions;
  }

  public get names() {
    return this.#options.definition.names;
  }

  public get services() {
    const { services } = this.#options;
    return services;
  }

  public get resource() {
    const { resource } = this.#options;
    return resource;
  }

  public get apiVersion() {
    return this.resource.apiVersion;
  }

  public get kind() {
    return this.resource.kind;
  }

  public get metadata(): KubernetesObject['metadata'] {
    const metadata = this.resource.metadata;
    return (
      metadata || {
        name: this.name,
        namespace: this.namespace,
      }
    );
  }

  public get name() {
    return this.resource.specifier.name;
  }

  public get namespace() {
    const namespace = this.resource.specifier.namespace;
    if (!namespace) {
      throw new Error('Custom resources needs a namespace');
    }
    return namespace;
  }

  public get exists() {
    return this.resource.exists;
  }

  public get ref() {
    return this.resource.ref;
  }

  public get spec(): z.infer<TSpec> {
    return this.resource.spec as ExpectedAny;
  }

  public get status() {
    return this.resource.manifest?.status;
  }

  public get isSeen() {
    return this.metadata?.generation === this.status?.observedGeneration;
  }

  public get isValidSpec() {
    const { success } = this.#options.definition.spec.safeParse(this.spec);
    return success;
  }

  public setup?: () => Promise<void>;
  public reconcile?: () => Promise<void>;

  public markSeen = async () => {
    if (this.isSeen) {
      return;
    }
    await this.patchStatus({
      observedGeneration: this.metadata?.generation,
    });
  };

  public queueReconcile = async () => {
    return this.#queue.run();
  };

  #handleChanged = () => {
    this.emit('changed');
  };

  public reconcileSubresource = async (name: string, action: () => Promise<SubresourceResult>) => {
    try {
      const result = await action();
      await this.conditions.set(name, {
        status: result.ready ? 'True' : 'False',
        syncing: result.syncing,
        failed: result.failed ?? false,
        resource: true,
        reason: result.reason,
        message: result.message,
      });
    } catch (err) {
      console.error(err);
      await this.conditions.set(name, {
        status: 'False',
        failed: true,
        reason: 'Failed',
        resource: true,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  public patchStatus = async (status: Partial<CustomResourceStatus>) => {
    const k8s = this.services.get(K8sService);
    const [group, version] = this.apiVersion?.split('/') || [];
    try {
      await k8s.customObjectsApi.patchNamespacedCustomObjectStatus(
        {
          group,
          version,
          plural: this.names.plural,
          name: this.name,
          namespace: this.namespace,
          body: {
            status,
          },
        },
        setHeaderOptions('Content-Type', PatchStrategy.MergePatch),
      );
    } catch (err) {
      if (err instanceof ApiException && err.code === 404) {
        return;
      }
      throw err;
    }
  };
}

export { CustomResource, type CustomResourceOptions, type CustomResourceObject, type SubresourceResult };
