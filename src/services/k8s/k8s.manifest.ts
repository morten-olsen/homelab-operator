import { ApiException, PatchStrategy, V1MicroTime } from '@kubernetes/client-node';

import type { Services } from '../../utils/service.ts';
import { K8sService } from '../k8s.ts';
import { GROUP } from '../../utils/consts.ts';
import { CustomResourceRegistry } from '../../custom-resource/custom-resource.registry.ts';

type ManifestOptions = {
  manifest: ExpectedAny;
  services: Services;
};

type ManifestMetadata = Record<string, string> & {
  name: string;
  namespace?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  uid: string;
  resourceVersion: string;
  creationTimestamp: string;
  generation: number;
};

type EventOptions = {
  reason: string;
  message: string;
  action: string;
  type: 'Normal' | 'Warning' | 'Error';
};

class Manifest<TSpec> {
  #options: ManifestOptions;

  constructor(options: ManifestOptions) {
    this.#options = {
      ...options,
      manifest: options.manifest,
    };
  }

  public get objectRef() {
    return {
      apiVersion: this.apiVersion,
      kind: this.kind,
      name: this.metadata.name,
      uid: this.metadata.uid,
      namespace: this.metadata.namespace,
    };
  }

  public get services(): Services {
    return this.#options.services;
  }

  public get manifest() {
    return this.#options.manifest;
  }

  protected set manifest(obj: ExpectedAny) {
    this.#options.manifest = obj;
  }

  public get kind(): string {
    return this.#options.manifest.kind;
  }

  public get apiVersion(): string {
    return this.#options.manifest.apiVersion;
  }

  public get spec(): TSpec {
    return this.#options.manifest.spec;
  }

  public get metadata(): ManifestMetadata {
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

  public addEvent = async (event: EventOptions) => {
    const { manifest, services } = this.#options;
    const k8sService = services.get(K8sService);

    await k8sService.eventsApi.createNamespacedEvent({
      namespace: manifest.metadata.namespace,
      body: {
        kind: 'Event',
        metadata: {
          name: `${manifest.metadata.name}-${Date.now()}-${Buffer.from(crypto.getRandomValues(new Uint8Array(8))).toString('hex')}`,
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

  public patch = async (manifest: ExpectedAny) => {
    const { services } = this.#options;
    const k8sService = services.get(K8sService);
    this.manifest = await k8sService.objectsApi.patch(
      {
        apiVersion: this.apiVersion,
        kind: this.kind,
        metadata: {
          name: this.metadata.name,
          namespace: this.metadata.namespace,
          ownerReferences: this.metadata.ownerReferences,
          ...manifest.metadata,
          labels: {
            ...this.metadata.labels,
            ...(manifest.metadata?.label || {}),
          },
          annotations: {
            ...this.metadata.annotations,
            ...(manifest.metadata?.annotations || {}),
          },
        },
        spec: manifest.spec || this.spec,
      },
      undefined,
      undefined,
      undefined,
      undefined,
      PatchStrategy.MergePatch,
    );
  };

  public update = async () => {
    const { manifest, services } = this.#options;
    const k8sService = services.get(K8sService);
    const registry = services.get(CustomResourceRegistry);
    const crd = registry.getByKind(manifest.kind);
    if (!crd) {
      throw new Error(`Custom resource ${manifest.kind} not found`);
    }
    try {
      const resource = await k8sService.objectsApi.read({
        apiVersion: this.apiVersion,
        kind: this.kind,
        metadata: {
          name: this.metadata.name,
          namespace: this.metadata.namespace,
        },
      });
      this.#options.manifest = resource;
    } catch (error) {
      if (error instanceof ApiException && error.code === 404) {
        return undefined;
      }
      throw error;
    }
  };
}

export { Manifest };
