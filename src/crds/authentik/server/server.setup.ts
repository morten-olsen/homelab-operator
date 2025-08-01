import z from 'zod';

import type { CustomResourceHandlerOptions } from '../../../custom-resource/custom-resource.base.ts';
import { K8sService } from '../../../services/k8s.ts';
import { PostgresService } from '../../../services/postgres/postgres.service.ts';
import { FIELDS, GROUP } from '../../../utils/consts.ts';

import type { authentikServerSpecSchema } from './server.schema.ts';

const toPostgresSafeName = (inputString: string): string => {
  let safeName = inputString.toLowerCase();
  safeName = safeName.replace(/[^a-z0-9_]/g, '_');
  safeName = safeName.replace(/^_+|_+$/g, '');
  if (safeName === '') {
    return 'default_name'; // Or throw new Error("Input resulted in an empty safe name.");
  }

  if (/^[0-9]/.test(safeName)) {
    safeName = '_' + safeName;
  }

  const MAX_PG_IDENTIFIER_LENGTH = 63;
  if (safeName.length > MAX_PG_IDENTIFIER_LENGTH) {
    safeName = safeName.substring(0, MAX_PG_IDENTIFIER_LENGTH);
  }

  return safeName;
};

const setupAuthentik = async ({
  services,
  request,
  ensureSecret,
}: CustomResourceHandlerOptions<typeof authentikServerSpecSchema>) => {
  const { name, namespace } = request.metadata;

  const k8sService = services.get(K8sService);
  const postgresService = services.get(PostgresService);

  const domainNamespace = request.spec.domain.namespace || namespace || 'default';

  const domain = await k8sService.get<ExpectedAny>({
    apiVersion: `${GROUP}/v1`,
    kind: 'Domain',
    name: request.spec.domain.name,
    namespace: domainNamespace,
  });

  if (!domain) {
    throw new Error(`Domain ${request.spec.domain.name} not found in namespace ${domainNamespace || 'default'}`);
  }

  const secretData = await ensureSecret({
    name: name,
    namespace: namespace || 'default',
    schema: z.object({
      secret: z.string(),
      token: z.string(),
      password: z.string(),
    }),
    generator: async () => ({
      secret: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex'),
      token: Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('hex'),
      password: Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('hex'),
    }),
  });

  const hostname = `${request.spec.subdomain}.${domain.spec.domain}`;

  const db = {
    name: toPostgresSafeName(`${namespace}_${name}`),
    user: toPostgresSafeName(`${namespace}_${name}_user`),
    password: 'sdf908sad0sdf7g98',
  };

  await postgresService.upsertRole({
    name: db.user,
    password: db.password,
  });

  await postgresService.upsertDatabase({
    name: db.name,
    owner: db.user,
  });

  const createManifest = (command: string) => ({
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name: `${name}-${command}`,
      namespace: namespace,
      labels: {
        'app.kubernetes.io/name': `${name}-${command}`,
        'argocd.argoproj.io/instance': 'homelab',
      },
      annotations: {
        [FIELDS.domain.domainId]: domain.dependencyId,
      },
      ownerReferences: [request.objectRef],
    },
    spec: {
      replicas: 1,
      selector: {
        matchLabels: {
          'app.kubernetes.io/name': `${name}-${command}`,
        },
      },
      template: {
        metadata: {
          labels: {
            'app.kubernetes.io/name': `${name}-${command}`,
          },
        },
        spec: {
          containers: [
            {
              name: `${name}-${command}`,
              image: 'ghcr.io/goauthentik/server:2025.6.4',
              // imagePullPolicy: 'ifNot'
              args: [command],
              env: [
                { name: 'AUTHENTIK_SECRET_KEY', value: secretData.secret },
                { name: 'AUTHENTIK_POSTGRESQL__HOST', value: 'postgres-postgresql.postgres.svc.cluster.local' },
                {
                  name: 'AUTHENTIK_POSTGRESQL__PORT',
                  value: '5432',
                },
                {
                  name: 'AUTHENTIK_POSTGRESQL__NAME',
                  value: db.name,
                },
                {
                  name: 'AUTHENTIK_POSTGRESQL__USER',
                  value: db.user,
                },
                {
                  name: 'AUTHENTIK_POSTGRESQL__PASSWORD',
                  value: db.password,
                },
                {
                  name: 'AUTHENTIK_REDIS__HOST',
                  value: 'redis.redis.svc.cluster.local',
                },
                {
                  name: 'AUTHENTIK_BOOTSTRAP_PASSWORD',
                  value: secretData.password,
                },
                {
                  name: 'AUTHENTIK_BOOTSTRAP_TOKEN',
                  value: secretData.token,
                },
                {
                  name: 'AUTHENTIK_BOOTSTRAP_EMAIL',
                  value: `admin@${hostname}`,
                },
                // {
                //   name: 'AUTHENTIK_REDIS__PORT',
                //   value: ''
                // }
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

  await k8sService.upsert(createManifest('server'));
  await k8sService.upsert(createManifest('worker'));
  await k8sService.upsert({
    apiVersion: 'v1',
    kind: 'Service',
    metadata: {
      name,
      namespace,
      labels: {
        'app.kubernetes.io/name': `${name}-server`,
      },
      ownerReferences: [request.objectRef],
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
        'app.kubernetes.io/name': `${name}-server`,
      },
    },
  });

  await k8sService.upsert({
    apiVersion: 'networking.istio.io/v1',
    kind: 'DestinationRule',
    metadata: {
      name,
      namespace,
      labels: {
        'app.kubernetes.io/name': `${name}-server`,
      },
      ownerReferences: [request.objectRef],
    },
    spec: {
      host: `${name}.${namespace || 'default'}.svc.cluster.local`,
      trafficPolicy: {
        tls: {
          mode: 'DISABLE',
        },
      },
    },
  });

  await k8sService.upsert({
    apiVersion: `${GROUP}/v1`,
    kind: 'DomainEndpoint',
    metadata: {
      name: request.metadata.name,
      namespace: request.metadata.namespace ?? 'default',
      labels: {
        'app.kubernetes.io/name': `${name}-domain-endpoint`,
      },
      ownerReferences: [request.objectRef],
    },
    spec: {
      domain: 'homelab/homelab',
      subdomain: request.spec.subdomain,
      destination: {
        name,
        namespace: namespace ?? 'default',
        port: {
          number: 9000,
        },
      },
    },
  });
};

export { setupAuthentik };
