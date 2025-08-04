import { ApiException, type KubernetesObject } from '@kubernetes/client-node';
import type { ZodObject } from 'zod';

import type { Services } from '../../utils/service.ts';
import type { Resource } from '../resources/resources.resource.ts';
import { WatcherService } from '../watchers/watchers.ts';
import { K8sService } from '../k8s/k8s.ts';
import { Queue } from '../queue/queue.ts';

import type { CustomResourceDefinition } from './custom-resources.types.ts';
import type { CustomResource } from './custom-resources.custom-resource.ts';
import { createManifest } from './custom-resources.utils.ts';

type DefinitionItem = {
  definition: CustomResourceDefinition<ExpectedAny>;
  queue: Queue;
};

class CustomResourceService {
  #services: Services;
  #definitions: DefinitionItem[];
  #resources: Map<string, CustomResource<ExpectedAny>>;

  constructor(services: Services) {
    this.#definitions = [];
    this.#resources = new Map();
    this.#services = services;
  }

  #handleChanged = async (resource: Resource<KubernetesObject>) => {
    const uid = resource.metadata?.uid;
    if (!uid) {
      return;
    }
    let current = this.#resources.get(uid);
    if (!current) {
      const entry = this.#definitions.find(
        ({ definition: r }) =>
          r.version === resource.version &&
          r.group === resource.group &&
          r.version === resource.version &&
          r.kind === resource.kind,
      );
      if (!entry) {
        return;
      }
      const { definition } = entry;
      current = definition.create({
        resource: resource as Resource<ExpectedAny>,
        services: this.#services,
        definition,
      });
      this.#resources.set(uid, current);
      await current.setup?.();
      if (!current.isSeen) {
        await current.markSeen();
      }
      await current.queueReconcile();
    } else if (!current.isSeen) {
      await current.markSeen();
      await current.queueReconcile();
    }
  };

  public register = (...resources: CustomResourceDefinition<ExpectedAny>[]) => {
    this.#definitions.push(
      ...resources.map((definition) => ({
        definition,
        queue: new Queue(),
      })),
    );
  };

  public install = async (replace = false) => {
    const k8sService = this.#services.get(K8sService);
    for (const { definition: crd } of this.#definitions) {
      this.#services.log.info('Installing CRD', { kind: crd.kind });
      try {
        const manifest = createManifest(crd);
        try {
          await k8sService.extensionsApi.createCustomResourceDefinition({
            body: manifest,
          });
        } catch (error) {
          if (error instanceof ApiException && error.code === 409) {
            if (replace) {
              await k8sService.extensionsApi.patchCustomResourceDefinition({
                name: manifest.metadata.name,
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

  public watch = async () => {
    const watcherService = this.#services.get(WatcherService);
    for (const { definition, queue } of this.#definitions) {
      const watcher = watcherService.create({
        path: `/apis/${definition.group}/${definition.version}/${definition.names.plural}`,
        list: (k8s) =>
          k8s.customObjectsApi.listCustomObjectForAllNamespaces({
            version: definition.version,
            group: definition.group,
            plural: definition.names.plural,
          }),
        verbs: ['add', 'update', 'delete'],
      });
      watcher.on('changed', (resource) => {
        queue.add(() => this.#handleChanged(resource));
      });
      await watcher.start();
    }
  };
}

const createCustomResourceDefinition = <TSpec extends ZodObject>(options: CustomResourceDefinition<TSpec>) => options;

export { CustomResourceService, createCustomResourceDefinition };
