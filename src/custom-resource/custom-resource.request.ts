import { z, type ZodObject } from 'zod';
import { setHeaderOptions } from '@kubernetes/client-node';

import type { Services } from '../utils/service.ts';
import { Manifest } from '../services/k8s/k8s.manifest.ts';
import { K8sService } from '../services/k8s.ts';

import { CustomResourceRegistry } from './custom-resource.registry.ts';

type CustomResourceRequestOptions = {
  type: 'ADDED' | 'DELETED' | 'MODIFIED';
  manifest: ExpectedAny;
  services: Services;
};

const customResourceStatusSchema = z.object({
  observedGeneration: z.number(),
  conditions: z.array(
    z.object({
      type: z.string(),
      status: z.enum(['True', 'False', 'Unknown']),
      lastTransitionTime: z.string().datetime(),
      reason: z.string().optional(),
      message: z.string().optional(),
    }),
  ),
});

type CustomResourceStatus = z.infer<typeof customResourceStatusSchema>;

class CustomResourceRequest<TSpec extends ZodObject> extends Manifest<z.infer<TSpec>> {
  #type: 'ADDED' | 'DELETED' | 'MODIFIED';

  constructor({ type, ...options }: CustomResourceRequestOptions) {
    super(options);
    this.#type = type;
  }

  public get schema() {
    return undefined as unknown as z.infer<TSpec>;
  }

  public get type(): 'ADDED' | 'DELETED' | 'MODIFIED' {
    return this.#type;
  }

  public markSeen = async () => {
    await this.setStatus({
      observedGeneration: this.manifest.metadata.generation,
    });
  };

  public setCondition = async (condition: Omit<CustomResourceStatus['conditions'][number], 'lastTransitionTime'>) => {
    const fullCondition = {
      ...condition,
      lastTransitionTime: new Date().toISOString(),
    };
    const conditions: CustomResourceStatus['conditions'] = this.manifest?.status?.conditions || [];
    const index = conditions.findIndex((c) => c.type === condition.type);
    if (index === -1) {
      conditions.push(fullCondition);
    } else {
      conditions[index] = fullCondition;
    }
    await this.setStatus({
      conditions,
    });
  };

  public getStatus = async () => {
    return this.manifest?.status as CustomResourceStatus | undefined;
  };

  public setStatus = async (status: Partial<CustomResourceStatus>) => {
    const { kind, metadata } = this.manifest;
    const registry = this.services.get(CustomResourceRegistry);
    const crd = registry.getByKind(kind);
    if (!crd) {
      throw new Error(`Custom resource ${kind} not found`);
    }

    const current = await this.manifest;
    const k8sService = this.services.get(K8sService);

    const { namespace = 'default', name } = metadata;

    const response = await k8sService.customObjectsApi.patchNamespacedCustomObjectStatus(
      {
        group: crd.group,
        version: crd.version,
        namespace,
        plural: crd.names.plural,
        name,
        body: {
          status: {
            observedGeneration: this.manifest.metadata.generation,
            conditions: current?.status?.conditions || [],
            ...current?.status,
            ...status,
          },
        },
        fieldValidation: 'Strict',
      },
      {
        ...setHeaderOptions('Content-Type', 'application/merge-patch+json'),
      },
    );
    this.manifest = response;
    return response;
  };
}

export { CustomResourceRequest, customResourceStatusSchema };
