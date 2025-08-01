import {
  KubeConfig,
  CoreV1Api,
  ApiextensionsV1Api,
  CustomObjectsApi,
  EventsV1Api,
  KubernetesObjectApi,
  ApiException,
  PatchStrategy,
} from '@kubernetes/client-node';

import type { Services } from '../utils/service.ts';

import { Manifest } from './k8s/k8s.manifest.ts';

class K8sService {
  #services: Services;
  #kc: KubeConfig;
  #k8sApi: CoreV1Api;
  #k8sExtensionsApi: ApiextensionsV1Api;
  #k8sCustomObjectsApi: CustomObjectsApi;
  #k8sEventsApi: EventsV1Api;
  #k8sObjectsApi: KubernetesObjectApi;

  constructor(services: Services) {
    this.#services = services;
    this.#kc = new KubeConfig();
    this.#kc.loadFromDefault();
    this.#k8sApi = this.#kc.makeApiClient(CoreV1Api);
    this.#k8sExtensionsApi = this.#kc.makeApiClient(ApiextensionsV1Api);
    this.#k8sCustomObjectsApi = this.#kc.makeApiClient(CustomObjectsApi);
    this.#k8sEventsApi = this.#kc.makeApiClient(EventsV1Api);
    this.#k8sObjectsApi = this.#kc.makeApiClient(KubernetesObjectApi);
  }

  public get config() {
    return this.#kc;
  }

  public get api() {
    return this.#k8sApi;
  }

  public get extensionsApi() {
    return this.#k8sExtensionsApi;
  }

  public get customObjectsApi() {
    return this.#k8sCustomObjectsApi;
  }

  public get eventsApi() {
    return this.#k8sEventsApi;
  }

  public get objectsApi() {
    return this.#k8sObjectsApi;
  }

  public exists = async (options: { apiVersion: string; kind: string; name: string; namespace?: string }) => {
    try {
      await this.objectsApi.read({
        apiVersion: options.apiVersion,
        kind: options.kind,
        metadata: {
          name: options.name,
          namespace: options.namespace,
        },
      });
      return true;
    } catch (err) {
      if (!(err instanceof ApiException && err.code === 404)) {
        throw err;
      }
      return false;
    }
  };

  public get = async <T>(options: { apiVersion: string; kind: string; name: string; namespace?: string }) => {
    try {
      const manifest = await this.objectsApi.read({
        apiVersion: options.apiVersion,
        kind: options.kind,
        metadata: {
          name: options.name,
          namespace: options.namespace,
        },
      });
      return new Manifest<T>({
        manifest,
        services: this.#services,
      });
    } catch (err) {
      if (!(err instanceof ApiException && err.code === 404)) {
        throw err;
      }
      return undefined;
    }
  };

  public upsert = async (obj: ExpectedAny) => {
    let current: unknown;
    try {
      current = await this.objectsApi.read({
        apiVersion: obj.apiVersion,
        kind: obj.kind,
        metadata: {
          name: obj.metadata.name,
          namespace: obj.metadata.namespace,
        },
      });
    } catch (error) {
      if (!(error instanceof ApiException && error.code === 404)) {
        throw error;
      }
    }

    if (current) {
      return new Manifest({
        manifest: await this.objectsApi.patch(
          obj,
          undefined,
          undefined,
          undefined,
          undefined,
          PatchStrategy.MergePatch,
        ),
        services: this.#services,
      });
    } else {
      return new Manifest({
        manifest: await this.objectsApi.create(obj),
        services: this.#services,
      });
    }
  };

  public getSecret = async <T extends Record<string, string>>(name: string, namespace?: string) => {
    const current = await this.get<ExpectedAny>({
      apiVersion: 'v1',
      kind: 'Secret',
      name,
      namespace,
    });

    if (!current) {
      return undefined;
    }

    const { data } = current.manifest || {};
    const decodedData = Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, Buffer.from(String(value), 'base64').toString('utf-8')]),
    );
    return decodedData as T;
  };
}

export { K8sService };
