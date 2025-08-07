import type { V1Deployment, V1Service } from '@kubernetes/client-node';

import type { CustomResourceObject } from '../../services/custom-resources/custom-resources.custom-resource.ts';
import type { redisConnectionSpecSchema } from '../redis-connection/redis-connection.schemas.ts';
import { API_VERSION, CONTROLLED_LABEL } from '../../utils/consts.ts';

const deploymentManifest = (): V1Deployment => ({
  apiVersion: 'apps/v1',
  kind: 'Deployment',
  metadata: {
    name: 'redis-server',
    namespace: 'homelab',
  },
  spec: {
    replicas: 1,
    selector: {
      matchLabels: {
        app: 'redis-server',
      },
    },
    template: {
      metadata: {
        labels: {
          app: 'redis-server',
        },
      },
      spec: {
        containers: [
          {
            name: 'redis-server',
            image: 'redis:latest',
            ports: [
              {
                containerPort: 6379,
              },
            ],
          },
        ],
      },
    },
  },
});

const serviceManifest = (): V1Service => ({
  apiVersion: 'v1',
  kind: 'Service',
  metadata: {
    name: 'redis-server',
    namespace: 'homelab',
  },
  spec: {
    selector: {
      app: 'redis-server',
    },
    ports: [
      {
        port: 6379,
      },
    ],
  },
});

type RedisConnectionManifestOptions = {
  secretName: string;
};

const connectionManifest = (
  options: RedisConnectionManifestOptions,
): CustomResourceObject<typeof redisConnectionSpecSchema> => ({
  apiVersion: API_VERSION,
  kind: 'RedisConnection',
  metadata: {
    labels: {
      ...CONTROLLED_LABEL,
    },
  },
  spec: {
    secret: options.secretName,
  },
});

export { deploymentManifest, serviceManifest, connectionManifest };
