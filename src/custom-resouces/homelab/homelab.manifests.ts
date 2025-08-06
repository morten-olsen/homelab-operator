import type { KubernetesObject } from '@kubernetes/client-node';

import type { K8SHelmRepositoryV1 } from '../../__generated__/resources/K8SHelmRepositoryV1.ts';
import type { K8SHelmReleaseV2 } from '../../__generated__/resources/K8SHelmReleaseV2.ts';

type IstioRepoManifestOptions = {
  owner: ExpectedAny;
};
const istioRepoManifest = (options: IstioRepoManifestOptions): KubernetesObject & K8SHelmRepositoryV1 => {
  return {
    apiVersion: 'source.toolkit.fluxcd.io/v1beta1',
    kind: 'HelmRepository',
    metadata: {
      ownerReferences: [options.owner],
    },
    spec: {
      interval: '1h',
      url: 'https://istio-release.storage.googleapis.com/charts',
    },
  };
};

type CertManagerRepoManifestOptions = {
  owner: ExpectedAny;
};
const certManagerRepoManifest = (options: CertManagerRepoManifestOptions): KubernetesObject & K8SHelmRepositoryV1 => {
  return {
    apiVersion: 'source.toolkit.fluxcd.io/v1',
    kind: 'HelmRepository',
    metadata: {
      ownerReferences: [options.owner],
    },
    spec: {
      interval: '1h',
      url: 'https://charts.jetstack.io',
    },
  };
};

type RanchRepoManifestOptions = {
  owner: ExpectedAny;
};
const ranchRepoManifest = (options: RanchRepoManifestOptions): KubernetesObject & K8SHelmRepositoryV1 => {
  return {
    apiVersion: 'source.toolkit.fluxcd.io/v1',
    kind: 'HelmRepository',
    metadata: {
      ownerReferences: [options.owner],
    },
    spec: {
      interval: '1h',
      url: 'https://charts.containeroo.ch',
    },
  };
};

type IstioBaseManifestOptions = {
  owner: ExpectedAny;
};
const istioBaseManifest = (options: IstioBaseManifestOptions): KubernetesObject & K8SHelmReleaseV2 => {
  return {
    apiVersion: 'helm.toolkit.fluxcd.io/v2',
    kind: 'HelmRelease',
    metadata: {
      ownerReferences: [options.owner],
    },
    spec: {
      interval: '1h',
      targetNamespace: 'istio-system',
      install: {
        createNamespace: true,
      },
      values: {
        defaultRevision: 'default',
      },
      chart: {
        spec: {
          chart: 'base',
          sourceRef: {
            apiVersion: 'source.toolkit.fluxcd.io/v1',
            kind: 'HelmRepository',
            name: 'homelab-istio',
          },
          reconcileStrategy: 'ChartVersion',
          version: '1.24.3',
        },
      },
    },
  };
};

type IstiodManifestOptions = {
  owner: ExpectedAny;
  namespace: string;
};
const istiodManifest = (options: IstiodManifestOptions): KubernetesObject & K8SHelmReleaseV2 => {
  return {
    apiVersion: 'helm.toolkit.fluxcd.io/v2',
    kind: 'HelmRelease',
    metadata: {
      ownerReferences: [options.owner],
    },
    spec: {
      targetNamespace: 'istio-system',
      interval: '1h',
      install: {
        createNamespace: true,
      },
      dependsOn: [
        {
          name: 'istio',
          namespace: options.namespace,
        },
      ],
      chart: {
        spec: {
          chart: 'istiod',
          sourceRef: {
            apiVersion: 'source.toolkit.fluxcd.io/v1',
            kind: 'HelmRepository',
            name: 'homelab-istio',
          },
          reconcileStrategy: 'ChartVersion',
          version: '1.24.3',
        },
      },
    },
  };
};

type IstioGatewayControllerManifestOptions = {
  owner: ExpectedAny;
  namespace: string;
};
const istioGatewayControllerManifest = (
  options: IstioGatewayControllerManifestOptions,
): KubernetesObject & K8SHelmReleaseV2 => {
  return {
    apiVersion: 'helm.toolkit.fluxcd.io/v2',
    kind: 'HelmRelease',
    metadata: {
      ownerReferences: [options.owner],
    },
    spec: {
      interval: '1h',
      install: {
        createNamespace: true,
      },
      dependsOn: [
        {
          name: 'istio',
          namespace: options.namespace,
        },
        {
          name: 'istiod',
          namespace: options.namespace,
        },
      ],
      values: {
        service: {
          ports: [
            {
              name: 'status-port',
              port: 15021,
            },
            {
              name: 'tls-istiod',
              port: 15012,
            },
            {
              name: 'tls',
              port: 15443,
              nodePort: 31371,
            },
            {
              name: 'http2',
              port: 80,
              nodePort: 31381,
              targetPort: 8280,
            },
            {
              name: 'https',
              port: 443,
              nodePort: 31391,
              targetPort: 8243,
            },
          ],
        },
      },
      chart: {
        spec: {
          chart: 'gateway',
          sourceRef: {
            apiVersion: 'source.toolkit.fluxcd.io/v1',
            kind: 'HelmRepository',
            name: 'homelab-istio',
          },
          reconcileStrategy: 'ChartVersion',
          version: '1.24.3',
        },
      },
    },
  };
};

type CertManagerManifestOptions = {
  owner: ExpectedAny;
};
const certManagerManifest = (options: CertManagerManifestOptions): KubernetesObject & K8SHelmReleaseV2 => {
  return {
    apiVersion: 'helm.toolkit.fluxcd.io/v2',
    kind: 'HelmRelease',
    metadata: {
      ownerReferences: [options.owner],
    },
    spec: {
      targetNamespace: 'cert-manager',
      interval: '1h',
      install: {
        createNamespace: true,
      },
      values: {
        installCRDs: true,
      },
      chart: {
        spec: {
          chart: 'cert-manager',
          sourceRef: {
            apiVersion: 'source.toolkit.fluxcd.io/v1',
            kind: 'HelmRepository',
            name: 'cert-manager',
          },
          version: 'v1.18.2',
        },
      },
    },
  };
};

type LocalStorageManifestOptions = {
  owner: ExpectedAny;
  storagePath: string;
};
const localStorageManifest = (options: LocalStorageManifestOptions): KubernetesObject & K8SHelmReleaseV2 => {
  return {
    apiVersion: 'helm.toolkit.fluxcd.io/v2',
    kind: 'HelmRelease',
    metadata: {
      ownerReferences: [options.owner],
    },
    spec: {
      targetNamespace: 'local-path-storage',
      interval: '1h',
      install: {
        createNamespace: true,
      },
      values: {
        storageClass: {
          name: 'local-path',
          defaultClass: true,
        },
        nodePathMap: [
          {
            node: 'DEFAULT_PATH_FOR_NON_LISTED_NODES',
            path: options.storagePath,
          },
        ],
        helper: {
          reclaimPolicy: 'Retain',
        },
      },
      chart: {
        spec: {
          chart: 'local-path-provisioner',
          sourceRef: {
            apiVersion: 'source.toolkit.fluxcd.io/v1',
            kind: 'HelmRepository',
            name: 'rancher',
          },
          version: '0.0.32',
        },
      },
    },
  };
};

export {
  istioRepoManifest,
  istioBaseManifest,
  istiodManifest,
  istioGatewayControllerManifest,
  certManagerRepoManifest,
  certManagerManifest,
  ranchRepoManifest,
  localStorageManifest,
};
