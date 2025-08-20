import { ApiException, PatchStrategy, type KubernetesObject } from '@kubernetes/client-node';
import { EventEmitter } from 'eventemitter3';
import deepEqual from 'deep-equal';

import type { Services } from '../../../utils/service.ts';
import { Queue } from '../../queue/queue.ts';
import { K8sService } from '../../k8s/k8s.ts';
import { isDeepSubset } from '../../../utils/objects.ts';

type ResourceSelector = {
  apiVersion: string;
  kind: string;
  name: string;
  namespace?: string;
};

type ResourceOptions<T extends KubernetesObject> = {
  services: Services;
  selector: ResourceSelector;
  manifest?: T;
};

type ResourceEvents = {
  changed: () => void;
};

class Resource<T extends KubernetesObject> extends EventEmitter<ResourceEvents> {
  #manifest?: T;
  #queue: Queue;
  #options: ResourceOptions<T>;

  constructor(options: ResourceOptions<T>) {
    super();
    this.#options = options;
    this.#manifest = options.manifest;
    this.#queue = new Queue({ concurrency: 1 });
  }

  public get services() {
    return this.#options.services;
  }

  public get manifest() {
    return this.#manifest;
  }

  public set manifest(value: T | undefined) {
    if (deepEqual(this.manifest, value)) {
      return;
    }
    this.#manifest = value;
    this.emit('changed');
  }

  public get exists() {
    return !!this.#manifest;
  }

  public get ready() {
    return this.exists;
  }

  public get selector() {
    return this.#options.selector;
  }

  public get apiVersion() {
    return this.selector.apiVersion;
  }

  public get kind() {
    return this.selector.kind;
  }

  public get name() {
    return this.selector.name;
  }

  public get namespace() {
    return this.selector.namespace;
  }

  public get metadata() {
    return this.manifest?.metadata;
  }

  public get ref() {
    if (!this.metadata?.uid) {
      throw new Error('No uid for resource');
    }
    return {
      apiVersion: this.apiVersion,
      kind: this.kind,
      name: this.name,
      uid: this.metadata.uid,
    };
  }

  public get spec(): (T extends { spec?: infer K } ? K : never) | undefined {
    const manifest = this.manifest;
    if (!manifest || !('spec' in manifest)) {
      return;
    }
    return manifest.spec as ExpectedAny;
  }

  public get data(): (T extends { data?: infer K } ? K : never) | undefined {
    const manifest = this.manifest;
    if (!manifest || !('data' in manifest)) {
      return;
    }
    return manifest.data as ExpectedAny;
  }

  public get status(): (T extends { status?: infer K } ? K : never) | undefined {
    const manifest = this.manifest;
    if (!manifest || !('status' in manifest)) {
      return;
    }
    return manifest.status as ExpectedAny;
  }

  public patch = (patch: T) =>
    this.#queue.add(async () => {
      const { services } = this.#options;
      services.log.debug(`Patching ${this.apiVersion}/${this.kind}/${this.namespace}/${this.name}`, {
        spelector: this.selector,
        current: this.manifest,
        patch,
      });
      const k8s = services.get(K8sService);
      const body = {
        ...patch,
        apiVersion: this.selector.apiVersion,
        kind: this.selector.kind,
        metadata: {
          ...patch.metadata,
          name: this.selector.name,
          namespace: this.selector.namespace,
        },
      };
      try {
        this.manifest = await k8s.objectsApi.patch(
          body,
          undefined,
          undefined,
          undefined,
          undefined,
          PatchStrategy.MergePatch,
        );
      } catch (err) {
        if (err instanceof ApiException && err.code === 404) {
          this.manifest = await k8s.objectsApi.create(body);
          return;
        }
        throw err;
      }
    });

  public getCondition = (
    condition: string,
  ): T extends { status?: { conditions?: (infer U)[] } } ? U | undefined : undefined => {
    const status = this.status as ExpectedAny;
    return status?.conditions?.find((c: ExpectedAny) => c?.type === condition);
  };

  public ensure = async (manifest: T) => {
    if (isDeepSubset(this.manifest, manifest)) {
      return false;
    }
    await this.patch(manifest);
    return true;
  };
}

export { Resource, type ResourceOptions, type ResourceEvents };
