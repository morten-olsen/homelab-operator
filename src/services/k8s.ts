import {
  KubeConfig,
  CoreV1Api,
  ApiextensionsV1Api,
  CustomObjectsApi,
  EventsV1Api,
  KubernetesObjectApi,
} from '@kubernetes/client-node';

class K8sService {
  #kc: KubeConfig;
  #k8sApi: CoreV1Api;
  #k8sExtensionsApi: ApiextensionsV1Api;
  #k8sCustomObjectsApi: CustomObjectsApi;
  #k8sEventsApi: EventsV1Api;
  #k8sObjectsApi: KubernetesObjectApi;

  constructor() {
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
}

export { K8sService };
