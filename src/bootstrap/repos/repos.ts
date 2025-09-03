import type { Services } from '../../utils/service.ts';
import { ResourceService } from '../../services/resources/resources.ts';
import { NAMESPACE } from '../../utils/consts.ts';

import { HelmRepo } from '#resources/flux/helm-repo/helm-repo.ts';

class RepoService {
  #jetstack: HelmRepo;
  #istio: HelmRepo;
  #authentik: HelmRepo;
  #cloudflare: HelmRepo;
  #argo: HelmRepo;

  constructor(services: Services) {
    const resourceService = services.get(ResourceService);
    this.#jetstack = resourceService.get(HelmRepo, 'jetstack', NAMESPACE);
    this.#istio = resourceService.get(HelmRepo, 'istio', NAMESPACE);
    this.#authentik = resourceService.get(HelmRepo, 'authentik', NAMESPACE);
    this.#cloudflare = resourceService.get(HelmRepo, 'cloudflare', NAMESPACE);
    this.#argo = resourceService.get(HelmRepo, 'argo', NAMESPACE);

    this.#jetstack.on('changed', this.ensure);
    this.#istio.on('changed', this.ensure);
    this.#authentik.on('changed', this.ensure);
    this.#cloudflare.on('changed', this.ensure);
    this.#argo.on('changed', this.ensure);
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

  public get cloudflare() {
    return this.#cloudflare;
  }

  public get argo() {
    return this.#argo;
  }

  public ensure = async () => {
    await this.#jetstack.set({
      url: 'https://charts.jetstack.io',
    });

    await this.#istio.set({
      url: 'https://istio-release.storage.googleapis.com/charts',
    });

    await this.#authentik.set({
      url: 'https://charts.goauthentik.io',
    });

    await this.#cloudflare.set({
      url: 'https://cloudflare.github.io/helm-charts',
    });

    await this.#argo.set({
      url: 'https://argoproj.github.io/argo-helm',
    });
  };
}

export { RepoService };
