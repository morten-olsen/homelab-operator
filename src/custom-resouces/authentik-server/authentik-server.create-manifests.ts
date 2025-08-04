import type { CustomResourceObject } from '../../services/custom-resources/custom-resources.custom-resource.ts';
import { API_VERSION, CONTROLLED_LABEL } from '../../utils/consts.ts';
import type { domainServiceSpecSchema } from '../domain-service/domain-service.schemas.ts';

type CreateContainerManifestOptions = {
  name: string;
  namespace: string;
  command: string;
  owner: ExpectedAny;
  secret: string;
  bootstrap: {
    email: string;
    password: string;
    token: string;
  };
  posgtres: {
    host: string;
    port: string;
    name: string;
    user: string;
    password: string;
  };
  redis: {
    host: string;
    port: string;
  };
};
const createManifest = (options: CreateContainerManifestOptions) => ({
  apiVersion: 'apps/v1',
  kind: 'Deployment',
  metadata: {
    name: options.name,
    namespace: options.namespace,
    labels: {
      'app.kubernetes.io/name': options.name,
      ...CONTROLLED_LABEL,
    },
    ownerReferences: [options.owner],
  },
  spec: {
    replicas: 1,
    selector: {
      matchLabels: {
        'app.kubernetes.io/name': options.name,
      },
    },
    template: {
      metadata: {
        labels: {
          'app.kubernetes.io/name': options.name,
        },
      },
      spec: {
        containers: [
          {
            name: options.name,
            image: 'ghcr.io/goauthentik/server:2025.6.4',
            args: [options.command],
            env: [
              { name: 'AUTHENTIK_SECRET_KEY', value: options.secret },
              { name: 'AUTHENTIK_POSTGRESQL__HOST', value: options.posgtres.host },
              {
                name: 'AUTHENTIK_POSTGRESQL__PORT',
                value: '5432',
              },
              {
                name: 'AUTHENTIK_POSTGRESQL__NAME',
                value: options.posgtres.name,
              },
              {
                name: 'AUTHENTIK_POSTGRESQL__USER',
                value: options.posgtres.user,
              },
              {
                name: 'AUTHENTIK_POSTGRESQL__PASSWORD',
                value: options.posgtres.password,
              },
              {
                name: 'AUTHENTIK_REDIS__HOST',
                value: options.redis.host,
              },
              {
                name: 'AUTHENTIK_REDIS__PORT',
                value: options.redis.port,
              },
              {
                name: 'AUTHENTIK_BOOTSTRAP_PASSWORD',
                value: options.bootstrap.password,
              },
              {
                name: 'AUTHENTIK_BOOTSTRAP_TOKEN',
                value: options.bootstrap.token,
              },
              {
                name: 'AUTHENTIK_BOOTSTRAP_EMAIL',
                value: options.bootstrap.email,
              },
            ],
            ports: [
              {
                name: 'http',
                containerPort: 9000,
                protocol: 'TCP',
              },
            ],
          },
        ],
      },
    },
  },
});

type CreateServiceManifestOptions = {
  name: string;
  namespace: string;
  owner: ExpectedAny;
  appName: string;
};
const createServiceManifest = (options: CreateServiceManifestOptions) => ({
  apiVersion: 'v1',
  kind: 'Service',
  metadata: {
    name: options.name,
    namespace: options.namespace,
    labels: {
      ...CONTROLLED_LABEL,
    },
    ownerReferences: [options.owner],
  },
  spec: {
    type: 'ClusterIP',
    ports: [
      {
        port: 9000,
        targetPort: 9000,
        protocol: 'TCP',
        name: 'http',
      },
    ],
    selector: {
      'app.kubernetes.io/name': options.appName,
    },
  },
});

type CreateDomainServiceOptions = {
  name: string;
  namespace: string;
  owner: ExpectedAny;
  subdomain: string;
  host: string;
  domain: string;
};
const createDomainService = (
  options: CreateDomainServiceOptions,
): Omit<CustomResourceObject<typeof domainServiceSpecSchema>, 'status'> => ({
  apiVersion: API_VERSION,
  kind: 'DomainService',
  metadata: {
    name: options.name,
    namespace: options.namespace,
    ownerReferences: [options.owner],
  },
  spec: {
    domain: options.domain,
    subdomain: options.subdomain,
    destination: {
      host: options.host,
      port: {
        number: 9000,
      },
    },
  },
});

export { createManifest, createServiceManifest, createDomainService };
