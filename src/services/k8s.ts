import { KubeConfig, CoreV1Api, ApiextensionsV1Api, CustomObjectsApi } from '@kubernetes/client-node';

class K8sService {
  #kc: KubeConfig;
  #k8sApi: CoreV1Api;
  #k8sExtensionsApi: ApiextensionsV1Api;
  #k8sCustomObjectsApi: CustomObjectsApi;

  constructor() {
    this.#kc = new KubeConfig();
    this.#kc.loadFromDefault();
    this.#k8sApi = this.#kc.makeApiClient(CoreV1Api);
    this.#k8sExtensionsApi = this.#kc.makeApiClient(ApiextensionsV1Api);
    this.#k8sCustomObjectsApi = this.#kc.makeApiClient(CustomObjectsApi);
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
}

export { K8sService };