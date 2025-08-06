import { type KubernetesObject } from '@kubernetes/client-node';

import {
  CustomResource,
  type CustomResourceOptions,
  type SubresourceResult,
} from '../../services/custom-resources/custom-resources.custom-resource.ts';
import { Resource, ResourceService } from '../../services/resources/resources.ts';
import type { K8SHelmRepositoryV1 } from '../../__generated__/resources/K8SHelmRepositoryV1.ts';
import type { K8SHelmReleaseV2 } from '../../__generated__/resources/K8SHelmReleaseV2.ts';
import { isDeepSubset } from '../../utils/objects.ts';

import type { homelabSpecSchema } from './homelab.schemas.ts';
import {
  certManagerRepoManifest,
  istioBaseManifest,
  istiodManifest,
  istioGatewayControllerManifest,
  istioRepoManifest,
  certManagerManifest,
  ranchRepoManifest,
  localStorageManifest,
} from './homelab.manifests.ts';

class HomelabResource extends CustomResource<typeof homelabSpecSchema> {
  #resources: {
    istioRepo: Resource<KubernetesObject & K8SHelmRepositoryV1>;
    istioBase: Resource<KubernetesObject & K8SHelmReleaseV2>;
    istiod: Resource<KubernetesObject & K8SHelmReleaseV2>;
    istioGatewayController: Resource<KubernetesObject & K8SHelmReleaseV2>;
    certManagerRepo: Resource<KubernetesObject & K8SHelmRepositoryV1>;
    certManager: Resource<KubernetesObject & K8SHelmReleaseV2>;
    ranchRepo: Resource<KubernetesObject & K8SHelmRepositoryV1>;
    localStorage: Resource<KubernetesObject & K8SHelmReleaseV2>;
  };

  constructor(options: CustomResourceOptions<typeof homelabSpecSchema>) {
    super(options);
    const resourceService = this.services.get(ResourceService);
    this.#resources = {
      istioRepo: resourceService.get({
        apiVersion: 'source.toolkit.fluxcd.io/v1',
        kind: 'HelmRepository',
        name: 'homelab-istio',
        namespace: this.namespace,
      }),
      istioBase: resourceService.get({
        apiVersion: 'helm.toolkit.fluxcd.io/v2',
        kind: 'HelmRelease',
        name: 'istio',
        namespace: this.namespace,
      }),
      istiod: resourceService.get({
        apiVersion: 'helm.toolkit.fluxcd.io/v2',
        kind: 'HelmRelease',
        name: 'istiod',
        namespace: this.namespace,
      }),
      istioGatewayController: resourceService.get({
        apiVersion: 'helm.toolkit.fluxcd.io/v2',
        kind: 'HelmRelease',
        name: 'istio-gateway-controller',
        namespace: this.namespace,
      }),
      certManagerRepo: resourceService.get({
        apiVersion: 'source.toolkit.fluxcd.io/v1',
        kind: 'HelmRepository',
        name: 'cert-manager',
        namespace: this.namespace,
      }),
      certManager: resourceService.get({
        apiVersion: 'helm.toolkit.fluxcd.io/v2',
        kind: 'HelmRelease',
        name: 'cert-manager',
        namespace: this.namespace,
      }),
      ranchRepo: resourceService.get({
        apiVersion: 'source.toolkit.fluxcd.io/v1',
        kind: 'HelmRepository',
        name: 'rancher',
        namespace: this.namespace,
      }),
      localStorage: resourceService.get({
        apiVersion: 'helm.toolkit.fluxcd.io/v2',
        kind: 'HelmRelease',
        name: 'local-storage',
        namespace: this.namespace,
      }),
    };

    for (const resource of Object.values(this.#resources)) {
      resource.on('changed', this.queueReconcile);
    }
  }

  #reconcileIstioRepo = async (): Promise<SubresourceResult> => {
    const istioRepo = this.#resources.istioRepo;
    const manifest = istioRepoManifest({
      owner: this.ref,
    });
    if (!isDeepSubset(istioRepo.spec, manifest.spec)) {
      await istioRepo.patch(manifest);
      return {
        ready: false,
        syncing: true,
        reason: 'UpdatingManifest',
      };
    }
    return {
      ready: true,
    };
  };

  #reconcileCertManagerRepo = async (): Promise<SubresourceResult> => {
    const certManagerRepo = this.#resources.certManagerRepo;
    const manifest = certManagerRepoManifest({
      owner: this.ref,
    });
    if (!isDeepSubset(certManagerRepo.spec, manifest.spec)) {
      await certManagerRepo.patch(manifest);
      return {
        ready: false,
        syncing: true,
        reason: 'UpdatingManifest',
      };
    }
    return {
      ready: true,
    };
  };

  #reconcileRanchRepo = async (): Promise<SubresourceResult> => {
    const ranchRepo = this.#resources.ranchRepo;
    const manifest = ranchRepoManifest({
      owner: this.ref,
    });
    if (!isDeepSubset(ranchRepo.spec, manifest.spec)) {
      await ranchRepo.patch(manifest);
      return {
        ready: false,
        syncing: true,
        reason: 'UpdatingManifest',
      };
    }
    return {
      ready: true,
    };
  };

  #reconcileIstioBase = async (): Promise<SubresourceResult> => {
    const istioBase = this.#resources.istioBase;
    const manifest = istioBaseManifest({
      owner: this.ref,
    });
    if (!isDeepSubset(istioBase.spec, manifest.spec)) {
      await istioBase.patch(manifest);
      return {
        ready: false,
        syncing: true,
        reason: 'UpdatingManifest',
      };
    }
    return {
      ready: true,
    };
  };

  #reconcileIstiod = async (): Promise<SubresourceResult> => {
    const istiod = this.#resources.istiod;
    const manifest = istiodManifest({
      owner: this.ref,
      namespace: this.namespace,
    });
    if (!isDeepSubset(istiod.spec, manifest.spec)) {
      await istiod.patch(manifest);
      return {
        ready: false,
        syncing: true,
        reason: 'UpdatingManifest',
      };
    }
    return {
      ready: true,
    };
  };

  #reconcileIstioGatewayController = async (): Promise<SubresourceResult> => {
    const istioGatewayController = this.#resources.istioGatewayController;
    const manifest = istioGatewayControllerManifest({
      owner: this.ref,
      namespace: this.namespace,
    });
    if (!isDeepSubset(istioGatewayController.spec, manifest.spec)) {
      await istioGatewayController.patch(manifest);
      return {
        ready: false,
        syncing: true,
        reason: 'UpdatingManifest',
      };
    }
    return {
      ready: true,
    };
  };

  #reconcileCertManager = async (): Promise<SubresourceResult> => {
    const certManager = this.#resources.certManager;
    const manifest = certManagerManifest({
      owner: this.ref,
    });
    if (!isDeepSubset(certManager.spec, manifest.spec)) {
      await certManager.patch(manifest);
      return {
        ready: false,
        syncing: true,
        reason: 'UpdatingManifest',
      };
    }
    return {
      ready: true,
    };
  };

  #reconcileLocalStorage = async (): Promise<SubresourceResult> => {
    const storage = this.spec.storage;
    if (!storage || !storage.enabled) {
      return {
        ready: true,
      };
    }
    const localStorage = this.#resources.localStorage;
    const manifest = localStorageManifest({
      owner: this.ref,
      storagePath: storage.path,
    });
    if (!isDeepSubset(localStorage.spec, manifest.spec)) {
      await localStorage.patch(manifest);
      return {
        ready: false,
        syncing: true,
        reason: 'UpdatingManifest',
      };
    }
    return {
      ready: true,
    };
  };

  public reconcile = async () => {
    await Promise.allSettled([
      this.reconcileSubresource('IstioRepo', this.#reconcileIstioRepo),
      this.reconcileSubresource('CertManagerRepo', this.#reconcileCertManagerRepo),
      this.reconcileSubresource('IstioBase', this.#reconcileIstioBase),
      this.reconcileSubresource('Istiod', this.#reconcileIstiod),
      this.reconcileSubresource('IstioGatewayController', this.#reconcileIstioGatewayController),
      this.reconcileSubresource('CertManager', this.#reconcileCertManager),
      this.reconcileSubresource('RanchRepo', this.#reconcileRanchRepo),
      this.reconcileSubresource('LocalStorage', this.#reconcileLocalStorage),
    ]);
  };
}

export { HomelabResource };
