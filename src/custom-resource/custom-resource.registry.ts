import { ApiException, Watch } from '@kubernetes/client-node';
import type { ZodObject } from 'zod';

import { K8sService } from '../services/k8s.ts';
import type { Services } from '../utils/service.ts';

import { type CustomResource, type EnsureSecretOptions } from './custom-resource.base.ts';
import { CustomResourceRequest } from './custom-resource.request.ts';

type ManifestCacheItem = {
  kind: string;
  namespace?: string;
  name?: string;
  manifest: CustomResourceRequest<ExpectedAny>;
};

type ManifestChangeOptions = {
  crd: CustomResource<ExpectedAny>;
  cacheKey: string;
  manifest: ExpectedAny;
};

class CustomResourceRegistry {
  #services: Services;
  #resources = new Set<CustomResource<ExpectedAny>>();
  #watchers = new Map<string, AbortController>();
  #cache = new Map<string, ManifestCacheItem>();

  constructor(services: Services) {
    this.#services = services;
  }

  public get kinds() {
    return Array.from(this.#resources).map((r) => r.kind);
  }

  public getByKind = (kind: string) => {
    return Array.from(this.#resources).find((r) => r.kind === kind);
  };

  public register = (resource: CustomResource<ExpectedAny>) => {
    this.#resources.add(resource);
  };

  public unregister = (resource: CustomResource<ExpectedAny>) => {
    this.#resources.delete(resource);
    this.#watchers.forEach((controller, kind) => {
      if (kind === resource.kind) {
        controller.abort();
        this.#watchers.delete(kind);
      }
    });
  };

  public watch = async () => {
    const k8sService = this.#services.get(K8sService);
    const watcher = new Watch(k8sService.config);
    for (const resource of this.#resources) {
      if (this.#watchers.has(resource.kind)) {
        continue;
      }
      const path = resource.path;
      const controller = await watcher.watch(path, {}, this.#onResourceEvent, this.#onError);
      this.#watchers.set(resource.kind, controller);
    }
  };

  #ensureSecret =
    (request: CustomResourceRequest<ExpectedAny>) =>
      async <T extends ZodObject>(options: EnsureSecretOptions<T>) => {
        const { schema, name, namespace, generator } = options;
        const { metadata } = request;
        const k8sService = this.#services.get(K8sService);
        let exists = false;
        try {
          const secret = await k8sService.api.readNamespacedSecret({
            name,
            namespace,
          });

          exists = true;
          if (secret?.data) {
            const decoded = Object.fromEntries(
              Object.entries(secret.data).map(([key, value]) => [key, Buffer.from(value, 'base64').toString('utf-8')]),
            );
            if (schema.safeParse(decoded).success) {
              return decoded;
            }
          }
        } catch (error) {
          if (!(error instanceof ApiException && error.code === 404)) {
            throw error;
          }
        }
        const value = await generator();
        const data = Object.fromEntries(
          Object.entries(value).map(([key, value]) => [key, Buffer.from(value as string).toString('base64')]),
        );
        const body = {
          kind: 'Secret',
          metadata: {
            name,
            namespace,
            ownerReferences: [
              {
                apiVersion: request.apiVersion,
                kind: request.kind,
                name: metadata.name,
                uid: metadata.uid,
              },
            ],
          },
          type: 'Opaque',
          data,
        };
        if (exists) {
          await k8sService.api.replaceNamespacedSecret({
            name,
            namespace,
            body,
          });
        } else {
          const response = await k8sService.api.createNamespacedSecret({
            namespace,
            body,
          });
          return response.data;
        }
      };

  public get objects() {
    return Array.from(this.#cache.values());
  }

  #onResourceUpdated = async (type: string, options: ManifestChangeOptions) => {
    const { cacheKey, manifest, crd } = options;
    const { kind, metadata } = manifest;
    const request = new CustomResourceRequest({
      type: type as 'ADDED' | 'MODIFIED',
      manifest: manifest,
      services: this.#services,
    });
    this.#cache.set(cacheKey, {
      kind,
      manifest: request,
    });
    const status = await request.getStatus();
    if (status && (type === 'ADDED' || type === 'MODIFIED')) {
      if (status.observedGeneration === metadata.generation) {
        this.#services.log.debug('Skipping resource update', {
          kind,
          name: metadata.name,
          namespace: metadata.namespace,
          observedGeneration: status.observedGeneration,
          generation: metadata.generation,
        });
        return;
      }
    }
    this.#services.log.debug('Updating resource', {
      type,
      kind,
      name: metadata.name,
      namespace: metadata.namespace,
      observedGeneration: status?.observedGeneration,
      generation: metadata.generation,
    });
    await request.markSeen();
    const handler = type === 'ADDED' && crd.create ? crd.create : crd.update;
    try {
      await handler?.({
        request,
        services: this.#services,
        ensureSecret: this.#ensureSecret(request) as ExpectedAny,
      });
      if (type === 'ADDED' || type === 'MODIFIED') {
        await request.setCondition({
          type: 'Ready',
          status: 'True',
          message: 'Resource created',
        });
      }
    } catch (error) {
      let message = 'Unknown error';

      if (error instanceof ApiException) {
        message = error.body;
        this.#services.log.error('Error handling resource', { reason: error.body }, error);
      } else if (error instanceof Error) {
        message = error.message;
        this.#services.log.error('Error handling resource', { reason: error.message }, error);
      } else {
        message = String(error);
        this.#services.log.error('Error handling resource', { reason: String(error) }, error);
      }
      if (type === 'ADDED' || type === 'MODIFIED') {
        await request.setCondition({
          type: 'Ready',
          status: 'False',
          reason: 'Error',
          message,
        });
      }
    }
  };

  #onDelete = async (options: ManifestChangeOptions) => {
    const { manifest, cacheKey } = options;
    const { kind, metadata } = manifest;

    this.#services.log.debug('Deleting resource', {
      kind,
      name: metadata.name,
      namespace: metadata.namespace,
      observedGeneration: manifest.status?.observedGeneration,
      generation: metadata.generation,
    });
    this.#cache.delete(cacheKey);
  };

  #onResourceEvent = async (type: string, manifest: ExpectedAny) => {
    const { kind, metadata } = manifest;
    const { name, namespace } = metadata;
    const cacheKey = [kind, name, namespace].join('___');
    const crd = this.getByKind(kind);
    if (!crd) {
      return;
    }

    const input = { cacheKey, manifest, crd };

    if (type === 'DELETE') {
      await this.#onDelete(input);
    } else {
      await this.#onResourceUpdated(type, input);
    }
  };

  #onError = (error: ExpectedAny) => {
    this.#services.log.error('Error watching resource', { error });
  };

  public install = async (replace = false) => {
    const k8sService = this.#services.get(K8sService);
    for (const crd of this.#resources) {
      this.#services.log.info('Installing CRD', { kind: crd.kind });
      try {
        const manifest = crd.toManifest();
        try {
          await k8sService.extensionsApi.createCustomResourceDefinition({
            body: manifest,
          });
        } catch (error) {
          if (error instanceof ApiException && error.code === 409) {
            if (replace) {
              await k8sService.extensionsApi.patchCustomResourceDefinition({
                name: crd.name,
                body: [{ op: 'replace', path: '/spec', value: manifest.spec }],
              });
            }
            continue;
          }
          throw error;
        }
      } catch (error) {
        if (error instanceof ApiException) {
          throw new Error(`Failed to install ${crd.kind}: ${error.body}`);
        }
        throw error;
      }
    }
  };
}

export { CustomResourceRegistry };
