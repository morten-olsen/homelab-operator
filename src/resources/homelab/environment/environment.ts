import { z } from 'zod';

import { PostgresCluster } from '../postgres-cluster/postgres-cluster.ts';
import { RedisServer } from '../redis-server/redis-server.ts';
import { AuthentikServer } from '../authentik-server/authentik-server.ts';

import { CustomResource, ResourceService, type CustomResourceOptions } from '#services/resources/resources.ts';
import { API_VERSION } from '#utils/consts.ts';
import { Namespace } from '#resources/core/namespace/namespace.ts';
import { Certificate } from '#resources/cert-manager/certificate/certificate.ts';
import { StorageClass } from '#resources/core/storage-class/storage-class.ts';
import { PROVISIONER } from '#resources/core/pvc/pvc.ts';
import { Gateway } from '#resources/istio/gateway/gateway.ts';
import { NotReadyError } from '#utils/errors.ts';
import { NamespaceService } from '#bootstrap/namespaces/namespaces.ts';
import { CloudflareService } from '#services/cloudflare/cloudflare.ts';
import { HelmRelease } from '#resources/flux/helm-release/helm-release.ts';
import { RepoService } from '#bootstrap/repos/repos.ts';

const specSchema = z.object({
  domain: z.string(),
  networkIp: z.string().optional(),
  tls: z.object({
    issuer: z.string(),
  }),
});

class Environment extends CustomResource<typeof specSchema> {
  public static readonly apiVersion = API_VERSION;
  public static readonly kind = 'Environment';
  public static readonly spec = specSchema;
  public static readonly scope = 'Cluster';

  #namespace: Namespace;
  #certificate: Certificate;
  #storageClass: StorageClass;
  #gateway: Gateway;
  #postgresCluster: PostgresCluster;
  #redisServer: RedisServer;
  #authentikServer: AuthentikServer;
  #cloudflareService: CloudflareService;
  #argoRelease: HelmRelease;
  #argoNamespace: Namespace;

  constructor(options: CustomResourceOptions<typeof specSchema>) {
    super(options);
    const resourceService = this.services.get(ResourceService);
    const namespaceService = this.services.get(NamespaceService);
    const homelabNamespace = namespaceService.homelab.name;

    this.#cloudflareService = this.services.get(CloudflareService);
    this.#cloudflareService.on('changed', this.queueReconcile);

    this.#namespace = resourceService.get(Namespace, this.name);
    this.#namespace.on('changed', this.queueReconcile);

    this.#certificate = resourceService.get(Certificate, this.name, homelabNamespace);
    this.#certificate.on('changed', this.queueReconcile);

    this.#storageClass = resourceService.get(StorageClass, this.name);
    this.#storageClass.on('changed', this.queueReconcile);

    this.#postgresCluster = resourceService.get(PostgresCluster, `${this.name}-postgres-cluster`, homelabNamespace);
    this.#postgresCluster.on('changed', this.queueReconcile);

    this.#redisServer = resourceService.get(RedisServer, `${this.name}-redis-server`, homelabNamespace);
    this.#redisServer.on('changed', this.queueReconcile);

    this.#gateway = resourceService.get(Gateway, this.name, homelabNamespace);
    this.#gateway.on('changed', this.queueReconcile);

    this.#authentikServer = resourceService.get(AuthentikServer, `${this.name}-authentik`, homelabNamespace);
    this.#authentikServer.on('changed', this.queueReconcile);

    this.#argoNamespace = resourceService.get(Namespace, `${this.name}-argo`);

    this.#argoRelease = resourceService.get(HelmRelease, `${this.name}-argo`, homelabNamespace);
    this.#argoRelease.on('changed', this.queueReconcile);
  }

  public get certificate() {
    return this.#certificate;
  }

  public get storageClass() {
    return this.#storageClass;
  }

  public get postgresCluster() {
    return this.#postgresCluster;
  }

  public get redisServer() {
    return this.#redisServer;
  }

  public get gateway() {
    return this.#gateway;
  }

  public get authentikServer() {
    return this.#authentikServer;
  }

  public reconcile = async () => {
    const { data: spec, success } = specSchema.safeParse(this.spec);
    if (!success || !spec) {
      throw new NotReadyError('InvalidSpec');
    }

    await this.#namespace.ensure({
      metadata: {
        labels: {
          'istio-injection': 'enabled',
        },
      },
    });
    await this.#certificate.ensure({
      spec: {
        secretName: `${this.name}-tls`,
        issuerRef: {
          name: spec.tls.issuer,
          kind: 'ClusterIssuer',
        },
        dnsNames: [`*.${spec.domain}`],
        privateKey: {
          rotationPolicy: 'Always',
        },
      },
    });
    await this.#storageClass.ensure({
      metadata: {
        ownerReferences: [this.ref],
      },
      provisioner: PROVISIONER,
      reclaimPolicy: 'Retain',
    });

    await this.#postgresCluster.ensure({
      metadata: {
        ownerReferences: [this.ref],
      },
      spec: {
        storageClass: this.name,
      },
    });

    await this.#redisServer.ensure({
      metadata: {
        ownerReferences: [this.ref],
      },
      spec: {},
    });

    await this.#authentikServer.ensure({
      metadata: {
        ownerReferences: [this.ref],
      },
      spec: {
        environment: this.name,
      },
    });

    await this.#gateway.set({
      metadata: {
        ownerReferences: [this.ref],
      },
      spec: {
        selector: {
          istio: 'homelab-istio-gateway',
        },
        servers: [
          {
            hosts: [`*.${spec.domain}`],
            port: {
              name: 'http',
              number: 80,
              protocol: 'HTTP',
            },
            tls: {
              httpsRedirect: true,
            },
          },
          {
            hosts: [`*.${spec.domain}`],
            port: {
              name: 'https',
              number: 443,
              protocol: 'HTTPS',
            },
            tls: {
              mode: 'SIMPLE',
              credentialName: `${this.name}-tls`,
            },
          },
        ],
      },
    });

    await this.#argoNamespace.ensure({});

    const repoService = this.services.get(RepoService);
    await this.#argoRelease.ensure({
      spec: {
        targetNamespace: this.#argoNamespace.name,
        interval: '1h',
        values: {
          applicationset: {
            enabled: true,
          },
        },
        chart: {
          spec: {
            chart: 'argo-cd',
            version: '3.9.0',
            sourceRef: {
              apiVersion: 'source.toolkit.fluxcd.io/v1',
              kind: 'HelmRepository',
              name: repoService.argo.name,
              namespace: repoService.argo.namespace,
            },
          },
        },
      },
    });
  };
}

export { Environment };
