import { CertificateInstance } from '../../instances/certificate.ts';
import { CustomDefinitionInstance } from '../../instances/custom-resource-definition.ts';
import { NamespaceInstance } from '../../instances/namespace.ts';
import {
  CustomResource,
  type CustomResourceOptions,
} from '../../services/custom-resources/custom-resources.custom-resource.ts';
import { ResourceService } from '../../services/resources/resources.ts';
import { GatewayInstance } from '../../instances/gateway.ts';
import { PostgresClusterInstance } from '../../instances/postgres-cluster.ts';
import { API_VERSION } from '../../utils/consts.ts';
import { AuthentikServerInstance } from '../../instances/authentik-server.ts';
import { StorageClassInstance } from '../../instances/storageclass.ts';
import { PROVISIONER } from '../../storage-provider/storage-provider.ts';
import { RedisServerInstance } from '../../instances/redis-server.ts';
import { NamespaceService } from '../../bootstrap/namespaces/namespaces.ts';

import type { environmentSpecSchema } from './environment.schemas.ts';

class EnvironmentController extends CustomResource<typeof environmentSpecSchema> {
  #namespace: NamespaceInstance;
  #certificateCrd: CustomDefinitionInstance;
  #certificate: CertificateInstance;
  #gatewayCrd: CustomDefinitionInstance;
  #gateway: GatewayInstance;
  #storageClass: StorageClassInstance;
  #postgresCluster: PostgresClusterInstance;
  #authentikServer: AuthentikServerInstance;
  #redisServer: RedisServerInstance;

  constructor(options: CustomResourceOptions<typeof environmentSpecSchema>) {
    super(options);
    const resourceService = this.services.get(ResourceService);
    const namespaceService = this.services.get(NamespaceService);
    this.#namespace = resourceService.getInstance(
      {
        apiVersion: 'v1',
        kind: 'Namespace',
        name: this.namespace,
      },
      NamespaceInstance,
    );
    this.#certificateCrd = resourceService.getInstance(
      {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        name: 'certificates.cert-manager.io',
      },
      CustomDefinitionInstance,
    );
    this.#certificate = resourceService.getInstance(
      {
        apiVersion: 'cert-manager.io/v1',
        kind: 'Certificate',
        name: `${this.name}-tls`,
        namespace: namespaceService.homelab.name,
      },
      CertificateInstance,
    );
    this.#gatewayCrd = resourceService.getInstance(
      {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        name: 'gateways.networking.istio.io',
      },
      CustomDefinitionInstance,
    );
    this.#gateway = resourceService.getInstance(
      {
        apiVersion: 'networking.istio.io/v1',
        kind: 'Gateway',
        name: this.name,
        namespace: this.namespace,
      },
      GatewayInstance,
    );
    this.#storageClass = resourceService.getInstance(
      {
        apiVersion: 'storage.k8s.io/v1',
        kind: 'StorageClass',
        name: `${this.name}-retain`,
      },
      StorageClassInstance,
    );
    this.#postgresCluster = resourceService.getInstance(
      {
        apiVersion: API_VERSION,
        kind: 'PostgresCluster',
        name: `${this.name}-postgres-cluster`,
        namespace: this.namespace,
      },
      PostgresClusterInstance,
    );
    this.#authentikServer = resourceService.getInstance(
      {
        apiVersion: API_VERSION,
        kind: 'AuthentikServer',
        name: `${this.name}-authentik-server`,
        namespace: this.namespace,
      },
      AuthentikServerInstance,
    );
    this.#redisServer = resourceService.getInstance(
      {
        apiVersion: API_VERSION,
        kind: 'RedisServer',
        name: `${this.name}-redis-server`,
        namespace: this.namespace,
      },
      RedisServerInstance,
    );
    this.#gatewayCrd.on('changed', this.queueReconcile);
    this.#gateway.on('changed', this.queueReconcile);
    this.#certificateCrd.on('changed', this.queueReconcile);
    this.#namespace.on('changed', this.queueReconcile);
    this.#certificate.on('changed', this.queueReconcile);
    this.#postgresCluster.on('changed', this.queueReconcile);
    this.#authentikServer.on('changed', this.queueReconcile);
    this.#storageClass.on('changed', this.queueReconcile);
    this.#redisServer.on('changed', this.queueReconcile);
  }

  public reconcile = async () => {
    if (!this.exists || this.metadata?.deletionTimestamp) {
      return;
    }
    await this.#namespace.ensure({
      metadata: {
        ownerReferences: [this.ref],
        labels: {
          'istio-injection': 'enabled',
        },
      },
    });
    if (this.#certificateCrd.ready) {
      await this.#certificate.ensure({
        spec: {
          secretName: `${this.name}-tls`,
          issuerRef: {
            name: this.spec.tls.issuer,
            kind: 'ClusterIssuer',
          },
          dnsNames: [`*.${this.spec.domain}`],
          privateKey: {
            rotationPolicy: 'Always',
          },
        },
      });
    }
    if (this.#gatewayCrd.ready) {
      await this.#gateway.ensure({
        metadata: {
          ownerReferences: [this.ref],
        },
        spec: {
          selector: {
            istio: 'homelab-istio-gateway',
          },
          servers: [
            {
              hosts: [`*.${this.spec.domain}`],
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
              hosts: [`*.${this.spec.domain}`],
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
      await this.#storageClass.ensure({
        provisioner: PROVISIONER,
        parameters: {
          storageLocation: this.spec.storage?.location || `/data/volumes/${this.name}`,
          reclaimPolicy: 'Retain',
          allowVolumeExpansion: 'true',
          volumeBindingMode: 'Immediate',
        },
      });
      await this.#postgresCluster.ensure({
        metadata: {
          ownerReferences: [this.ref],
        },
        spec: {
          environment: this.name,
        },
      });
      await this.#authentikServer.ensure({
        metadata: {
          ownerReferences: [this.ref],
        },
        spec: {
          environment: `${this.namespace}/${this.name}`,
          subdomain: 'authentik',
          postgresCluster: `${this.name}-postgres-cluster`,
          redisServer: `${this.name}-redis-server`,
        },
      });
      await this.#redisServer.ensure({
        metadata: {
          ownerReferences: [this.ref],
        },
        spec: {},
      });
    }
  };
}

export { EnvironmentController };
