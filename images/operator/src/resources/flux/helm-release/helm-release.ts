import type { KubernetesObject } from '@kubernetes/client-node';
import type { K8SHelmReleaseV2 } from 'src/__generated__/resources/K8SHelmReleaseV2.ts';

import { Resource } from '#services/resources/resources.ts';

type SetOptions = {
  namespace?: string;
  values?: Record<string, unknown>;
  chart: {
    name: string;
    namespace?: string;
  };
};

class HelmRelease extends Resource<KubernetesObject & K8SHelmReleaseV2> {
  public static readonly apiVersion = 'helm.toolkit.fluxcd.io/v2';
  public static readonly kind = 'HelmRelease';

  public set = async (options: SetOptions) => {
    return await this.ensure({
      spec: {
        targetNamespace: options.namespace,
        interval: '1h',
        values: options.values,
        chart: {
          spec: {
            chart: 'cert-manager',
            version: 'v1.18.2',
            sourceRef: {
              apiVersion: 'source.toolkit.fluxcd.io/v1',
              kind: 'HelmRepository',
              name: options.chart.name,
              namespace: options.chart.namespace,
            },
          },
        },
      },
    });
  };
}

export { HelmRelease };
