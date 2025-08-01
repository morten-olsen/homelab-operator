import { NAMESPACE } from '../../utils/consts.ts';
import type { Services } from '../../utils/service.ts';
import { K8sService } from '../k8s.ts';
import { PostgresService } from '../postgres/postgres.service.ts';

const SECRET = 'WkE/MDsSCe7TyIPtx/16/rwQ3XyyY9QsM450mXZklhR545PZPFoXcfrBhnxYB5jzlIwTmkg7Opgm0FDl'; // TODO: Generate and store
const setupAuthentik = async (services: Services) => {
  const namespace = NAMESPACE;
  const db = {
    name: 'homelab_authentik',
    user: 'homelab_authentik',
    password: 'sdf908sad0sdf7g98',
  };

  const k8sService = services.get(K8sService);
  const postgresService = services.get(PostgresService);

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
      name: `authentik-${command}`,
      namespace: namespace,
      labels: {
        'app.kubernetes.io/name': `authentik-${command}`,
        'argocd.argoproj.io/instance': 'homelab',
      },
    },
    spec: {
      replicas: 1,
      selector: {
        matchLabels: {
          'app.kubernetes.io/name': `authentik-${command}`,
        },
      },
      template: {
        metadata: {
          labels: {
            'app.kubernetes.io/name': `authentik-${command}`,
          },
        },
        spec: {
          containers: [
            {
              name: `authentik-${command}`,
              image: 'ghcr.io/goauthentik/server:2025.6.4',
              // imagePullPolicy: 'ifNot'
              args: [command],
              env: [
                { name: 'AUTHENTIK_SECRET_KEY', value: SECRET },
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
      name: 'authentik',
      namespace,
      labels: {
        'app.kubernetes.io/name': 'authentik-server',
      },
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
        'app.kubernetes.io/name': 'authentik-server',
      },
    },
  });

  return {
    url: '',
    token: '',
  };
};

export { setupAuthentik };
