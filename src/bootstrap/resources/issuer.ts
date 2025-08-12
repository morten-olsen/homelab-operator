import { ClusterIssuerInstance } from '../../instances/cluster-issuer.ts';
import { CustomDefinitionInstance } from '../../instances/custom-resource-definition.ts';
import { ResourceService } from '../../services/resources/resources.ts';
import type { Services } from '../../utils/service.ts';

class ClusterIssuerService {
  #clusterIssuerCrd: CustomDefinitionInstance;
  #clusterIssuer: ClusterIssuerInstance;

  constructor(services: Services) {
    const resourceService = services.get(ResourceService);
    this.#clusterIssuerCrd = resourceService.getInstance(
      {
        apiVersion: 'v1',
        kind: 'CustomResourceDefinition',
        name: 'clusterissuers.cert-manager.io',
      },
      CustomDefinitionInstance,
    );
    this.#clusterIssuer = resourceService.getInstance(
      {
        apiVersion: 'v1',
        kind: 'ClusterIssuer',
        name: 'cluster-issuer',
      },
      ClusterIssuerInstance,
    );

    this.#clusterIssuerCrd.on('changed', this.ensure);
    this.#clusterIssuer.on('changed', this.ensure);
  }

  public ensure = async () => {
    if (!this.#clusterIssuerCrd.ready) {
      return;
    }
    await this.#clusterIssuer.ensure({
      spec: {
        acme: {
          server: 'https://acme-v02.api.letsencrypt.org/directory',
          email: 'admin@example.com',
          privateKeySecretRef: {
            name: 'cluster-issuer-key',
          },
          solvers: [
            {
              dns01: {
                cloudflare: {
                  email: 'admin@example.com',
                  apiKeySecretRef: {
                    name: 'cloudflare-api-key',
                    key: 'api-key',
                  },
                },
              },
            },
          ],
        },
      },
    });
  };
}

export { ClusterIssuerService };
