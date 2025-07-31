import { ApiException, PatchStrategy, setHeaderOptions, V1MicroTime } from '@kubernetes/client-node';
import { z, type ZodObject } from 'zod';

import type { Services } from '../utils/service.ts';
import { K8sService } from '../services/k8s.ts';
import { GROUP } from '../utils/consts.ts';

import { CustomResourceRegistry } from './custom-resource.registry.ts';

type CustomResourceRequestOptions = {
  type: 'ADDED' | 'DELETED' | 'MODIFIED';
  manifest: ExpectedAny;
  services: Services;
};

type CustomResourceRequestMetadata = Record<string, string> & {
  name: string;
  namespace?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  uid: string;
  resourceVersion: string;
  creationTimestamp: string;
  generation: number;
};

type CustomResourceEvent = {
  reason: string;
  message: string;
  action: string;
  type: 'Normal' | 'Warning' | 'Error';
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

class CustomResourceRequest<TSpec extends ZodObject> {
  #options: CustomResourceRequestOptions;

  constructor(options: CustomResourceRequestOptions) {
    this.#options = options;
  }

  public get services(): Services {
    return this.#options.services;
  }

  public get type(): 'ADDED' | 'DELETED' | 'MODIFIED' {
    return this.#options.type;
  }

  public get manifest() {
    return this.#options.manifest;
  }

  public get kind(): string {
    return this.#options.manifest.kind;
  }

  public get apiVersion(): string {
    return this.#options.manifest.apiVersion;
  }

  public get spec(): z.infer<TSpec> {
    return this.#options.manifest.spec;
  }

  public get metadata(): CustomResourceRequestMetadata {
    return this.#options.manifest.metadata;
  }

  public isOwnerOf = (manifest: ExpectedAny) => {
    const ownerRef = manifest?.metadata?.ownerReferences || [];
    return ownerRef.some(
      (ref: ExpectedAny) =>
        ref.apiVersion === this.apiVersion &&
        ref.kind === this.kind &&
        ref.name === this.metadata.name &&
        ref.uid === this.metadata.uid,
    );
  };

  public markSeen = async () => {
    const { manifest } = this.#options;
    await this.setStatus({
      observedGeneration: manifest.metadata.generation,
    });
  };

  public setCondition = async (condition: Omit<CustomResourceStatus['conditions'][number], 'lastTransitionTime'>) => {
    const fullCondition = {
      ...condition,
      lastTransitionTime: new Date().toISOString(),
    };
    const current = await this.getCurrent();
    const conditions: CustomResourceStatus['conditions'] = current?.status?.conditions || [];
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
    const current = await this.getCurrent();
    return current?.status as CustomResourceStatus | undefined;
  };

  public addEvent = async (event: CustomResourceEvent) => {
    const { manifest, services } = this.#options;
    const k8sService = services.get(K8sService);

    await k8sService.eventsApi.createNamespacedEvent({
      namespace: manifest.metadata.namespace,
      body: {
        kind: 'Event',
        metadata: {
          name: `${manifest.metadata.name}-${Date.now()}`,
          namespace: manifest.metadata.namespace,
        },
        eventTime: new V1MicroTime(),
        note: event.message,
        action: event.action,
        reason: event.reason,
        type: event.type,
        reportingController: GROUP,
        reportingInstance: manifest.metadata.name,
        regarding: {
          apiVersion: manifest.apiVersion,
          resourceVersion: manifest.metadata.resourceVersion,
          kind: manifest.kind,
          name: manifest.metadata.name,
          namespace: manifest.metadata.namespace,
          uid: manifest.metadata.uid,
        },
      },
    });
  };

  public setStatus = async (status: Partial<CustomResourceStatus>) => {
    const { manifest, services } = this.#options;
    const { kind, metadata } = manifest;
    const registry = services.get(CustomResourceRegistry);
    const crd = registry.getByKind(kind);
    const current = await this.getCurrent();
    if (!crd) {
      throw new Error(`Custom resource ${kind} not found`);
    }

    const k8sService = services.get(K8sService);

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
            observedGeneration: manifest.metadata.generation,
            conditions: current?.status?.conditions || [],
            ...current?.status,
            ...status,
          },
        },
        fieldValidation: 'Strict',
      },
      setHeaderOptions('Content-Type', PatchStrategy.MergePatch),
    );
    return response;
  };

  public getCurrent = async () => {
    const { manifest, services } = this.#options;
    const k8sService = services.get(K8sService);
    const registry = services.get(CustomResourceRegistry);
    const crd = registry.getByKind(manifest.kind);
    if (!crd) {
      throw new Error(`Custom resource ${manifest.kind} not found`);
    }
    try {
      const resource = await k8sService.customObjectsApi.getNamespacedCustomObject({
        group: crd.group,
        version: crd.version,
        plural: crd.names.plural,
        namespace: manifest.metadata.namespace,
        name: manifest.metadata.name,
      });
      return resource as {
        apiVersion: string;
        kind: string;
        metadata: CustomResourceRequestMetadata;
        spec: z.infer<TSpec>;
        status: CustomResourceStatus;
      };
    } catch (error) {
      if (error instanceof ApiException && error.code === 404) {
        return undefined;
      }
      throw error;
    }
  };
}

export { CustomResourceRequest, customResourceStatusSchema };
