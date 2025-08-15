import { ApiException, PatchStrategy, V1MicroTime, type KubernetesObject } from '@kubernetes/client-node';
import { EventEmitter } from 'eventemitter3';
import equal from 'deep-equal';

import { Services } from '../../utils/service.ts';
import { K8sService } from '../k8s/k8s.ts';
import { Queue } from '../queue/queue.ts';
import { GROUP } from '../../utils/consts.ts';

import { ResourceService } from './resources.ts';

type ResourceOptions<T extends KubernetesObject> = {
  services: Services;
  manifest?: T;
  data: {
    apiVersion: string;
    kind: string;
    name: string;
    namespace?: string;
  };
};

type UnknownResource = KubernetesObject & {
  spec: ExpectedAny;
  data: ExpectedAny;
};

type EventOptions = {
  reason: string;
  message: string;
  action: string;
  type: 'Normal' | 'Warning' | 'Error';
};

type ResourceEvents<T extends KubernetesObject> = {
  updated: () => void;
  deleted: () => void;
  changed: () => void;
  changedStatus: (options: {
    previous: T extends { status: infer K } ? K | undefined : never;
    next: T extends { status: infer K } ? K | undefined : never;
  }) => void;
  changedMetadate: (options: { previous: T['metadata'] | undefined; next: T['metadata'] | undefined }) => void;
  changedSpec: (options: {
    previous: T extends { spec: infer K } ? K | undefined : never;
    next: T extends { spec: infer K } ? K | undefined : never;
  }) => void;
};

class Resource<T extends KubernetesObject = UnknownResource> extends EventEmitter<ResourceEvents<T>> {
  #options: ResourceOptions<T>;
  #queue: Queue;

  constructor(options: ResourceOptions<T>) {
    super();
    this.#options = options;
    this.#queue = new Queue({ concurrency: 1 });
  }

  public get services() {
    return this.#options.services;
  }

  public get specifier() {
    return this.#options.data;
  }

  public get manifest() {
    return this.#options?.manifest;
  }

  public set manifest(obj: T | undefined) {
    if (equal(obj, this.manifest)) {
      return;
    }
    this.#options.manifest = obj;
    const nextManifest = obj || {};
    const currentManifest = this.manifest || {};
    const nextStatus = 'status' in nextManifest ? nextManifest.status : undefined;
    const currentStatus = 'status' in currentManifest ? currentManifest.status : undefined;
    if (!equal(nextStatus, currentStatus)) {
      this.emit('changedStatus', {
        previous: currentStatus as ExpectedAny,
        next: nextStatus as ExpectedAny,
      });
    }

    const nextSpec = 'spec' in nextManifest ? nextManifest.spec : undefined;
    const currentSpec = 'spec' in currentManifest ? currentManifest.spec : undefined;
    if (!equal(nextSpec, currentSpec)) {
      this.emit('changedSpec', {
        next: nextSpec as ExpectedAny,
        previous: currentSpec as ExpectedAny,
      });
    }

    const nextMetadata = 'metadata' in nextManifest ? nextManifest.metadata : undefined;
    const currentMetadata = 'metadata' in currentManifest ? currentManifest.metadata : undefined;
    if (!equal(nextMetadata, currentMetadata)) {
      this.emit('changedMetadate', {
        next: nextMetadata as ExpectedAny,
        previous: currentMetadata as ExpectedAny,
      });
    }

    this.emit('updated');
    this.emit('changed');
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

  public get exists() {
    return !!this.manifest;
  }

  public get apiVersion() {
    return this.#options.data.apiVersion;
  }

  public get group() {
    const [group] = this.apiVersion?.split('/') || [];
    return group;
  }

  public get version() {
    const [, version] = this.apiVersion?.split('/') || [];
    return version;
  }

  public get kind() {
    return this.#options.data.kind;
  }

  public get metadata() {
    return this.manifest?.metadata;
  }

  public get name() {
    return this.#options.data.name;
  }

  public get namespace() {
    return this.#options.data.namespace;
  }

  public get spec(): T extends { spec?: infer K } ? K | undefined : never {
    if (this.manifest && 'spec' in this.manifest) {
      return this.manifest.spec as ExpectedAny;
    }
    return undefined as ExpectedAny;
  }

  public get data(): T extends { data?: infer K } ? K | undefined : never {
    if (this.manifest && 'data' in this.manifest) {
      return this.manifest.data as ExpectedAny;
    }
    return undefined as ExpectedAny;
  }

  public get status(): T extends { status?: infer K } ? K | undefined : never {
    if (this.manifest && 'status' in this.manifest) {
      return this.manifest.status as ExpectedAny;
    }
    return undefined as ExpectedAny;
  }

  public get owners() {
    const { services } = this.#options;
    const references = this.metadata?.ownerReferences || [];
    const resourceService = services.get(ResourceService);
    return references.map((ref) =>
      resourceService.get({
        apiVersion: ref.apiVersion,
        kind: ref.kind,
        name: ref.name,
        namespace: this.namespace,
      }),
    );
  }

  public patch = (patch: T) =>
    this.#queue.add(async () => {
      const { services } = this.#options;
      services.log.debug(`Patching ${this.apiVersion}/${this.kind}/${this.namespace}/${this.name}`, {
        specifier: this.specifier,
        current: this.manifest,
        patch,
      });
      const k8s = services.get(K8sService);
      const body = {
        ...patch,
        apiVersion: this.specifier.apiVersion,
        kind: this.specifier.kind,
        metadata: {
          ...patch.metadata,
          name: this.specifier.name,
          namespace: this.specifier.namespace,
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

  public delete = () =>
    this.#queue.add(async () => {
      try {
        const { services } = this.#options;
        services.log.debug(`Deleting ${this.apiVersion}/${this.kind}/${this.namespace}/${this.name}`);
        const k8s = services.get(K8sService);
        await k8s.objectsApi.delete({
          apiVersion: this.specifier.apiVersion,
          kind: this.specifier.kind,
          metadata: {
            name: this.specifier.name,
            namespace: this.specifier.namespace,
          },
        });
        this.manifest = undefined;
      } catch (err) {
        if (err instanceof ApiException && err.code === 404) {
          return;
        }
        throw err;
      }
    });

  public load = () =>
    this.#queue.add(async () => {
      const { services } = this.#options;
      const k8s = services.get(K8sService);
      try {
        const manifest = await k8s.objectsApi.read({
          apiVersion: this.specifier.apiVersion,
          kind: this.specifier.kind,
          metadata: {
            name: this.specifier.name,
            namespace: this.specifier.namespace,
          },
        });
        this.manifest = manifest as T;
      } catch (err) {
        if (err instanceof ApiException && err.code === 404) {
          this.manifest = undefined;
        } else {
          throw err;
        }
      }
    });

  public addEvent = (event: EventOptions) =>
    this.#queue.add(async () => {
      const { services } = this.#options;
      const k8sService = services.get(K8sService);

      services.log.debug(`Adding event ${this.apiVersion}/${this.kind}/${this.namespace}/${this.name}`, event);

      await k8sService.eventsApi.createNamespacedEvent({
        namespace: this.specifier.namespace || 'default',
        body: {
          kind: 'Event',
          metadata: {
            name: `${this.specifier.name}-${Date.now()}-${Buffer.from(crypto.getRandomValues(new Uint8Array(8))).toString('hex')}`,
            namespace: this.specifier.namespace,
          },
          eventTime: new V1MicroTime(),
          note: event.message,
          action: event.action,
          reason: event.reason,
          type: event.type,
          reportingController: GROUP,
          reportingInstance: this.name,
          regarding: {
            apiVersion: this.specifier.apiVersion,
            resourceVersion: this.metadata?.resourceVersion,
            kind: this.specifier.kind,
            name: this.specifier.name,
            namespace: this.specifier.namespace,
            uid: this.metadata?.uid,
          },
        },
      });
    });
}

export { Resource, type UnknownResource, type ResourceEvents };
