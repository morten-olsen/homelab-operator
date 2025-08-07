import type { V1Deployment, V1PersistentVolumeClaim, V1Service } from '@kubernetes/client-node';

import type { CustomResourceObject } from '../../services/custom-resources/custom-resources.custom-resource.ts';
import type { postgresConnectionSpecSchema } from '../postgres-connection/posgtres-connection.schemas.ts';
import { API_VERSION } from '../../utils/consts.ts';

type PvcOptions = {
  name: string;
  owner: ExpectedAny;
};
const pvcManifest = (options: PvcOptions): V1PersistentVolumeClaim => {
  return {
    apiVersion: 'v1',
    kind: 'PersistentVolumeClaim',
    metadata: {
      ownerReferences: [options.owner],
      name: options.name,
      labels: {
        app: options.name,
      },
      annotations: {
        'volume.kubernetes.io/storage-class': 'local-path',
      },
    },
    spec: {
      accessModes: ['ReadWriteOnce'],
      resources: {
        requests: {
          storage: '10Gi',
        },
      },
    },
  };
};

type DeploymentManifetOptions = {
  name: string;
  owner: ExpectedAny;
  user: string;
  password: string;
};
const deploymentManifest = (options: DeploymentManifetOptions): V1Deployment => {
  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      ownerReferences: [options.owner],
    },
    spec: {
      replicas: 1,
      selector: {
        matchLabels: {
          app: options.name,
        },
      },
      template: {
        metadata: {
          labels: {
            app: options.name,
          },
        },
        spec: {
          volumes: [{ name: options.name, persistentVolumeClaim: { claimName: options.name } }],
          containers: [
            {
              name: options.name,
              image: 'postgres:17',
              ports: [{ containerPort: 5432 }],
              volumeMounts: [{ mountPath: '/var/lib/postgresql/data', name: options.name }],
              env: [
                { name: 'POSTGRES_USER', value: options.user },
                { name: 'POSTGRES_PASSWORD', value: options.password },
              ],
            },
          ],
        },
      },
    },
  };
};

type ServiceManifestOptions = {
  name: string;
  owner: ExpectedAny;
};
const serviceManifest = (options: ServiceManifestOptions): V1Service => {
  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: {
      ownerReferences: [options.owner],
      name: options.name,
      labels: {
        app: options.name,
      },
    },
    spec: {
      type: 'ClusterIP',
      ports: [{ port: 5432, targetPort: 5432 }],
      selector: {
        app: options.name,
      },
    },
  };
};

type ConnectionManifestOptions = {
  name: string;
  owner: ExpectedAny;
};
const connectionManifest = (
  options: ConnectionManifestOptions,
): CustomResourceObject<typeof postgresConnectionSpecSchema> => ({
  apiVersion: API_VERSION,
  kind: 'PostgresConnection',
  metadata: {
    ownerReferences: [options.owner],
  },
  spec: {
    secret: `${options.name}-secret`,
  },
});

export { pvcManifest, deploymentManifest, serviceManifest, connectionManifest };
