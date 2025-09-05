import type { KubernetesObject } from '@kubernetes/client-node';
import type { K8SHelmRepositoryV1 } from 'src/__generated__/resources/K8SHelmRepositoryV1.ts';

import { Resource } from '#services/resources/resources.ts';

type SetOptions = {
  url: string;
};
class HelmRepo extends Resource<KubernetesObject & K8SHelmRepositoryV1> {
  public static readonly apiVersion = 'source.toolkit.fluxcd.io/v1';
  public static readonly kind = 'HelmRepository';
  public static readonly plural = 'helmrepositories';

  public set = async ({ url }: SetOptions) => {
    await this.ensure({
      spec: {
        interval: '1h',
        url,
      },
    });
  };
}

export { HelmRepo };
