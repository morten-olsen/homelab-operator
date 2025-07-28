import { ApiException, Watch } from '@kubernetes/client-node';

import { K8sService } from '../services/k8s.ts';
import type { Services } from '../utils/service.ts';

import { type CustomResource } from './custom-resource.base.ts';
import { CustomResourceRequest } from './custom-resource.request.ts';

class CustomResourceRegistry {
  #services: Services;
  #resources = new Set<CustomResource<any>>();
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

  public register = (resource: CustomResource<any>) => {
    this.#resources.add(resource);
  };

  public unregister = (resource: CustomResource<any>) => {
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

  #onResourceEvent = async (type: string, obj: any) => {
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
    if (status.observedGeneration === obj.metadata.generation) {
      this.#services.log.debug('Skipping resource update', {
        observedGeneration: status.observedGeneration,
        generation: obj.metadata.generation,
      });
      return;
    }

    if (type === 'ADDED' && crd.create) {
      handler = crd.create;
    }

    await handler?.({
      request,
      services: this.#services,
    });
  };

  #onError = (error: any) => {
    console.error(error);
  };

  public install = async (replace = false) => {
    const k8sService = this.#services.get(K8sService);
    for (const crd of this.#resources) {
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
    }
  };
}

export { CustomResourceRegistry };
