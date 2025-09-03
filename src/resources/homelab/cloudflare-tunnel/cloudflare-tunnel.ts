import {
  CustomResource,
  Resource,
  ResourceService,
  type CustomResourceOptions,
} from '#services/resources/resources.ts';
import z from 'zod';
import { ExternalHttpService } from '../external-http-service.ts/external-http-service.ts';
import { API_VERSION } from '#utils/consts.ts';
import { HelmRelease } from '#resources/flux/helm-release/helm-release.ts';
import { RepoService } from '#bootstrap/repos/repos.ts';
import { Secret } from '#resources/core/secret/secret.ts';
import { NotReadyError } from '#utils/errors.ts';
import { NamespaceService } from '#bootstrap/namespaces/namespaces.ts';

const specSchema = z.object({});

type SecretData = {
  account: string;
  tunnelName: string;
  tunnelId: string;
  secret: string;
};
class CloudflareTunnel extends CustomResource<typeof specSchema> {
  public static readonly apiVersion = API_VERSION;
  public static readonly kind = 'CloudflareTunnel';
  public static readonly spec = specSchema;
  public static readonly scope = 'Cluster';

  #helmRelease: HelmRelease;
  #secret: Secret<SecretData>;

  constructor(options: CustomResourceOptions<typeof specSchema>) {
    super(options);
    const resourceService = this.services.get(ResourceService);
    const namespaceService = this.services.get(NamespaceService);
    const namespace = namespaceService.homelab.name;
    resourceService.on('changed', this.#handleResourceChanged);

    this.#helmRelease = resourceService.get(HelmRelease, this.name, namespace);
    this.#secret = resourceService.get(Secret<SecretData>, 'cloudflare', namespace);
    this.#secret.on('changed', this.queueReconcile);
  }

  #handleResourceChanged = (resource: Resource<ExpectedAny>) => {
    if (resource instanceof CloudflareTunnel) {
      this.queueReconcile();
    }
  };

  public reconcile = async () => {
    const secret = this.#secret.value;
    if (!secret) {
      throw new NotReadyError('MissingSecret', `Secret ${this.#secret.namespace}/${this.#secret.name} does not exist`);
    }
    const resourceService = this.services.get(ResourceService);
    const repoService = this.services.get(RepoService);
    const routes = resourceService.getAllOfKind(ExternalHttpService);
    const ingress = routes.map(({ rule }) => ({
      hostname: rule?.hostname,
      service: `http://${rule?.destination.host}:${rule?.destination.port.number}`,
    }));
    await this.#helmRelease.ensure({
      metadata: {
        ownerReferences: [this.ref],
      },
      spec: {
        interval: '1h',
        values: {
          cloudflare: {
            account: secret.account,
            tunnelName: secret.tunnelName,
            tunnelId: secret.tunnelId,
            secret: secret.secret,
            ingress,
          },
        },
        chart: {
          spec: {
            chart: 'cloudflare-tunnel',
            sourceRef: {
              apiVersion: 'source.toolkit.fluxcd.io/v1',
              kind: 'HelmRepository',
              name: repoService.cloudflare.name,
              namespace: repoService.cloudflare.namespace,
            },
          },
        },
      },
    });
  };
}

export { CloudflareTunnel };
