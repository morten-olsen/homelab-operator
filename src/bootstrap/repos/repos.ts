import type { Services } from '../../utils/service.ts';
import { ResourceService } from '../../services/resources/resources.ts';
import { HelmRepoInstance } from '../../instances/helm-repo.ts';
import { NAMESPACE } from '../../utils/consts.ts';

class RepoService {
  #jetstack: HelmRepoInstance;
  #istio: HelmRepoInstance;
  #authentik: HelmRepoInstance;
  #containerro: HelmRepoInstance;

  constructor(services: Services) {
    const resourceService = services.get(ResourceService);
    this.#jetstack = resourceService.getInstance(
      {
        apiVersion: 'source.toolkit.fluxcd.io/v1',
        kind: 'HelmRepository',
        name: 'jetstack',
        namespace: NAMESPACE,
      },
      HelmRepoInstance,
    );
    this.#istio = resourceService.getInstance(
      {
        apiVersion: 'source.toolkit.fluxcd.io/v1',
        kind: 'HelmRepository',
        name: 'istio',
        namespace: NAMESPACE,
      },
      HelmRepoInstance,
    );
    this.#authentik = resourceService.getInstance(
      {
        apiVersion: 'source.toolkit.fluxcd.io/v1',
        kind: 'HelmRepository',
        name: 'authentik',
        namespace: NAMESPACE,
      },
      HelmRepoInstance,
    );
    this.#containerro = resourceService.getInstance(
      {
        apiVersion: 'source.toolkit.fluxcd.io/v1',
        kind: 'HelmRepository',
        name: 'containerro',
        namespace: NAMESPACE,
      },
      HelmRepoInstance,
    );
    this.#jetstack.on('changed', this.ensure);
    this.#istio.on('changed', this.ensure);
    this.#authentik.on('changed', this.ensure);
    this.#containerro.on('changed', this.ensure);
  }

  public get jetstack() {
    return this.#jetstack;
  }
  public get istio() {
    return this.#istio;
  }
  public get authentik() {
    return this.#authentik;
  }
  public get containerro() {
    return this.#containerro;
  }

  public ensure = async () => {
    await this.#jetstack.ensure({
      metadata: {
        name: 'jetstack',
      },
      spec: {
        interval: '1h',
        url: 'https://charts.jetstack.io',
      },
    });

    await this.#istio.ensure({
      metadata: {
        name: 'istio',
      },
      spec: {
        interval: '1h',
        url: 'https://istio-release.storage.googleapis.com/charts',
      },
    });

    await this.#authentik.ensure({
      metadata: {
        name: 'authentik',
      },
      spec: {
        interval: '1h',
        url: 'https://charts.goauthentik.io',
      },
    });

    await this.#containerro.ensure({
      metadata: {
        name: 'containerro',
      },
      spec: {
        interval: '1h',
        url: 'https://charts.containeroo.ch',
      },
    });
  };
}

export { RepoService };
