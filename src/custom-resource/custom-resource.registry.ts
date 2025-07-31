import { ApiException, Watch } from '@kubernetes/client-node';
import type { ZodObject } from 'zod';

import { K8sService } from '../services/k8s.ts';
import type { Services } from '../utils/service.ts';

import { type CustomResource, type EnsureSecretOptions } from './custom-resource.base.ts';
import { CustomResourceRequest } from './custom-resource.request.ts';

class CustomResourceRegistry {
  #services: Services;
  #resources = new Set<CustomResource<ExpectedAny>>();
  #watchers = new Map<string, AbortController>();

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

  #onResourceEvent = async (type: string, obj: ExpectedAny) => {
    const { kind } = obj;
    const crd = this.getByKind(kind);
    if (!crd) {
      return;
    }

    let handler = type === 'DELETED' ? crd.delete : crd.update;
    const request = new CustomResourceRequest({
      type: type as 'ADDED' | 'DELETED' | 'MODIFIED',
      manifest: obj,
      services: this.#services,
    });

    const status = await request.getStatus();
    if (status && (type === 'ADDED' || type === 'MODIFIED')) {
      if (status.observedGeneration === obj.metadata.generation) {
        this.#services.log.debug('Skipping resource update', {
          kind,
          name: obj.metadata.name,
          namespace: obj.metadata.namespace,
          observedGeneration: status.observedGeneration,
          generation: obj.metadata.generation,
        });
        return;
      }
    }

    this.#services.log.debug('Updating resource', {
      type,
      kind,
      name: obj.metadata.name,
      namespace: obj.metadata.namespace,
      observedGeneration: status?.observedGeneration,
      generation: obj.metadata.generation,
    });

    if (type === 'ADDED' || type === 'MODIFIED') {
      await request.markSeen();
    }

    if (type === 'ADDED' && crd.create) {
      handler = crd.create;
    }

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
        this.#services.log.error('Error handling resource', { reason: error.body });
      } else if (error instanceof Error) {
        message = error.message;
        this.#services.log.error('Error handling resource', { reason: error.message });
      } else {
        message = String(error);
        this.#services.log.error('Error handling resource', { reason: String(error) });
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
