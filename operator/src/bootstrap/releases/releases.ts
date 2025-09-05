import { ResourceService } from '../../services/resources/resources.ts';
import { NAMESPACE } from '../../utils/consts.ts';
import { Services } from '../../utils/service.ts';
import { NamespaceService } from '../namespaces/namespaces.ts';
import { RepoService } from '../repos/repos.ts';

import { HelmRelease } from '#resources/flux/helm-release/helm-release.ts';

class ReleaseService {
  #services: Services;
  #certManager: HelmRelease;
  #istioBase: HelmRelease;
  #istiod: HelmRelease;
  #istioGateway: HelmRelease;

  constructor(services: Services) {
    this.#services = services;
    const resourceService = services.get(ResourceService);
    this.#certManager = resourceService.get(HelmRelease, 'cert-manager', NAMESPACE);
    this.#istioBase = resourceService.get(HelmRelease, 'istio-base', NAMESPACE);
    this.#istiod = resourceService.get(HelmRelease, 'istiod', NAMESPACE);
    this.#istioGateway = resourceService.get(HelmRelease, 'istio-gateway', NAMESPACE);

    this.#certManager.on('changed', this.ensure);
    this.#istioBase.on('changed', this.ensure);
    this.#istiod.on('changed', this.ensure);
    this.#istioGateway.on('changed', this.ensure);
  }

  public get certManager() {
    return this.#certManager;
  }
  public get istioBase() {
    return this.#istioBase;
  }
  public get istiod() {
    return this.#istiod;
  }

  public ensure = async () => {
    const namespaceService = this.#services.get(NamespaceService);
    const repoService = this.#services.get(RepoService);
    await this.#certManager.ensure({
      spec: {
        targetNamespace: namespaceService.certManager.name,
        interval: '1h',
        values: {
          installCRDs: true,
        },
        chart: {
          spec: {
            chart: 'cert-manager',
            version: 'v1.18.2',
            sourceRef: {
              apiVersion: 'source.toolkit.fluxcd.io/v1',
              kind: 'HelmRepository',
              name: repoService.jetstack.name,
              namespace: repoService.jetstack.namespace,
            },
          },
        },
      },
    });
    await this.#istioBase.ensure({
      spec: {
        targetNamespace: namespaceService.istioSystem.name,
        interval: '1h',
        values: {
          defaultRevision: 'default',
          profile: 'ambient',
        },
        chart: {
          spec: {
            chart: 'base',
            version: '1.24.3',
            sourceRef: {
              apiVersion: 'source.toolkit.fluxcd.io/v1',
              kind: 'HelmRepository',
              name: repoService.istio.name,
              namespace: repoService.istio.namespace,
            },
          },
        },
      },
    });
    await this.#istiod.ensure({
      spec: {
        targetNamespace: namespaceService.istioSystem.name,
        interval: '1h',
        dependsOn: [
          {
            name: this.#istioBase.name,
            namespace: this.#istioBase.namespace,
          },
        ],
        chart: {
          spec: {
            chart: 'istiod',
            version: '1.24.3',
            sourceRef: {
              apiVersion: 'source.toolkit.fluxcd.io/v1',
              kind: 'HelmRepository',
              name: repoService.istio.name,
              namespace: repoService.istio.namespace,
            },
          },
        },
      },
    });
    await this.#istioGateway.ensure({
      spec: {
        targetNamespace: NAMESPACE,
        interval: '1h',
        dependsOn: [
          {
            name: this.#istioBase.name,
            namespace: this.#istioBase.namespace,
          },
          {
            name: this.#istiod.name,
            namespace: this.#istiod.namespace,
          },
        ],
        chart: {
          spec: {
            chart: 'gateway',
            version: '1.24.3',
            sourceRef: {
              apiVersion: 'source.toolkit.fluxcd.io/v1',
              kind: 'HelmRepository',
              name: repoService.istio.name,
              namespace: repoService.istio.namespace,
            },
          },
        },
      },
    });
  };
}

export { ReleaseService };
