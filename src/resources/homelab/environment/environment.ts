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

const specSchema = z.object({
  domain: z.string(),
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

  constructor(options: CustomResourceOptions<typeof specSchema>) {
    super(options);
    const resourceService = this.services.get(ResourceService);

    this.#namespace = resourceService.get(Namespace, this.name);
    this.#namespace.on('changed', this.queueReconcile);

    this.#certificate = resourceService.get(Certificate, this.name, this.name);
    this.#certificate.on('changed', this.queueReconcile);

    this.#storageClass = resourceService.get(StorageClass, this.name);
    this.#storageClass.on('changed', this.queueReconcile);

    this.#postgresCluster = resourceService.get(PostgresCluster, `${this.name}-postgres-cluster`, this.name);
    this.#postgresCluster.on('changed', this.queueReconcile);

    this.#redisServer = resourceService.get(RedisServer, `${this.name}-redis-server`, this.name);
    this.#redisServer.on('changed', this.queueReconcile);

    this.#gateway = resourceService.get(Gateway, this.name, this.name);
    this.#gateway.on('changed', this.queueReconcile);

    this.#authentikServer = resourceService.get(AuthentikServer, `${this.name}-authentik`, this.name);
    this.#authentikServer.on('changed', this.queueReconcile);
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
      return;
    }
    await this.#namespace.ensure({
      metadata: {
        labels: {
          'istio-injection': 'enabled',
        },
      },
    });
    if (this.#certificate.hasCRD) {
      await this.#certificate.ensure({
        metadata: {
          ownerReferences: [this.ref],
        },
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
    }
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
  };
}

export { Environment };
