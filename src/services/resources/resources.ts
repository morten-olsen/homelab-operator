import { ApiException, type KubernetesObject } from '@kubernetes/client-node';
import type { ZodType } from 'zod';

import type { Services } from '../../utils/service.ts';
import { WatcherService } from '../watchers/watchers.ts';

import { Resource, type ResourceOptions } from './resource/resource.ts';
import { createManifest } from './resources.utils.ts';

import { K8sService } from '#services/k8s/k8s.ts';

type ResourceClass<T extends KubernetesObject> = (new (options: ResourceOptions<T>) => Resource<T>) & {
  apiVersion: string;
  kind: string;
  plural?: string;
};

type InstallableResourceClass<T extends KubernetesObject> = ResourceClass<T> & {
  spec: ZodType;
  status: ZodType;
  scope: 'Namespaced' | 'Cluster';
};

class ResourceService {
  #services: Services;
  #registry: Map<
    ResourceClass<ExpectedAny>,
    {
      apiVersion: string;
      kind: string;
      plural?: string;
      resources: Resource<ExpectedAny>[];
    }
  >;

  constructor(services: Services) {
    this.#services = services;
    this.#registry = new Map();
  }

  public register = async (...resources: ResourceClass<ExpectedAny>[]) => {
    for (const resource of resources) {
      if (!this.#registry.has(resource)) {
        this.#registry.set(resource, {
          apiVersion: resource.apiVersion,
          kind: resource.kind,
          plural: resource.plural,
          resources: [],
        });
      }
      const watcherService = this.#services.get(WatcherService);
      const watcher = watcherService.create({
        ...resource,
        verbs: ['add', 'update', 'delete'],
      });
      watcher.on('changed', (manifest) => {
        const { name, namespace } = manifest.metadata || {};
        if (!name) {
          return;
        }
        const current = this.get(resource, name, namespace);
        current.manifest = manifest;
      });
      await watcher.start();
    }
  };

  public get = <T extends ResourceClass<ExpectedAny>>(type: T, name: string, namespace?: string) => {
    let resourceRegistry = this.#registry.get(type);
    if (!resourceRegistry) {
      resourceRegistry = {
        apiVersion: type.apiVersion,
        kind: type.kind,
        plural: type.plural,
        resources: [],
      };
      this.#registry.set(type, resourceRegistry);
    }
    const { resources, apiVersion, kind } = resourceRegistry;
    let current = resources.find((resource) => resource.name === name && resource.namespace === namespace);
    if (!current) {
      current = new type({
        selector: {
          apiVersion,
          kind,
          name,
          namespace,
        },
        services: this.#services,
      });
      resources.push(current);
    }
    return current as InstanceType<T>;
  };

  public install = async (...resources: InstallableResourceClass<ExpectedAny>[]) => {
    const k8sService = this.#services.get(K8sService);
    for (const resource of resources) {
      this.#services.log.info('Installing CRD', { kind: resource.kind });
      try {
        const manifest = createManifest(resource);
        try {
          await k8sService.extensionsApi.createCustomResourceDefinition({
            body: manifest,
          });
        } catch (error) {
          if (error instanceof ApiException && error.code === 409) {
            await k8sService.extensionsApi.patchCustomResourceDefinition({
              name: manifest.metadata.name,
              body: [{ op: 'replace', path: '/spec', value: manifest.spec }],
            });
            continue;
          }
          throw error;
        }
      } catch (error) {
        if (error instanceof ApiException) {
          throw new Error(`Failed to install ${resource.kind}: ${error.body}`);
        }
        throw error;
      }
    }
  };
}

export { CustomResource, type CustomResourceOptions } from './resource/resource.custom.ts';
export { ResourceReference } from './resource/resource.reference.ts';
export { ResourceService, Resource, type ResourceOptions, type ResourceClass, type InstallableResourceClass };
