import type { V1Deployment, V1PersistentVolumeClaim, V1Service } from '@kubernetes/client-node';

import {
  CustomResource,
  type CustomResourceObject,
  type CustomResourceOptions,
  type SubresourceResult,
} from '../../services/custom-resources/custom-resources.custom-resource.ts';
import { ResourceService, type Resource } from '../../services/resources/resources.ts';
import {
  postgresConnectionSecretDataSchema,
  type postgresConnectionSpecSchema,
} from '../postgres-connection/posgtres-connection.schemas.ts';
import { API_VERSION } from '../../utils/consts.ts';
import { isDeepSubset } from '../../utils/objects.ts';
import type { EnsuredSecret } from '../../services/secrets/secrets.secret.ts';
import { SecretService } from '../../services/secrets/secrets.ts';

import type { postgresClusterSpecSchema } from './postgres-cluster.schemas.ts';
import { connectionManifest, deploymentManifest, pvcManifest, serviceManifest } from './postgres-cluster.manifests.ts';

class PostgresClusterResource extends CustomResource<typeof postgresClusterSpecSchema> {
  #resources: {
    pvc: Resource<V1PersistentVolumeClaim>;
    deployment: Resource<V1Deployment>;
    service: Resource<V1Service>;
    connection: Resource<CustomResourceObject<typeof postgresConnectionSpecSchema>>;
    secret: EnsuredSecret<typeof postgresConnectionSecretDataSchema>;
  };

  constructor(options: CustomResourceOptions<typeof postgresClusterSpecSchema>) {
    super(options);
    const resourceService = this.services.get(ResourceService);
    const secretService = this.services.get(SecretService);
    this.#resources = {
      pvc: resourceService.get({
        apiVersion: 'v1',
        kind: 'PersistentVolumeClaim',
        name: this.name,
        namespace: this.namespace,
      }),
      deployment: resourceService.get({
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        name: this.name,
        namespace: this.namespace,
      }),
      service: resourceService.get({
        apiVersion: 'v1',
        kind: 'Service',
        name: this.name,
        namespace: this.namespace,
      }),
      connection: resourceService.get({
        apiVersion: API_VERSION,
        kind: 'PostgresConnection',
        name: this.name,
        namespace: this.namespace,
      }),
      secret: secretService.ensure({
        name: `${this.name}-secret`,
        namespace: this.namespace,
        schema: postgresConnectionSecretDataSchema,
        generator: () => ({
          host: `${this.name}.${this.namespace}.svc.cluster.local`,
          port: '5432',
          user: 'postgres',
          password: Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('hex'),
        }),
      }),
    };
  }

  #reconcilePvc = async (): Promise<SubresourceResult> => {
    const pvc = this.#resources.pvc;
    const manifest = pvcManifest({
      name: this.name,
      owner: this.ref,
    });
    if (!isDeepSubset(pvc.spec, manifest.spec)) {
      await pvc.patch(manifest);
      return {
        ready: false,
        syncing: true,
        reason: 'UpdatingManifest',
      };
    }
    return {
      ready: true,
    };
  };

  #reconcileDeployment = async (): Promise<SubresourceResult> => {
    const secret = this.#resources.secret;
    if (!secret.isValid || !secret.value) {
      return {
        ready: false,
        syncing: true,
        reason: 'SecretNotReady',
      };
    }
    const deployment = this.#resources.deployment;
    const manifest = deploymentManifest({
      name: this.name,
      owner: this.ref,
      user: secret.value.user,
      password: secret.value.password,
    });
    if (!isDeepSubset(deployment.spec, manifest.spec)) {
      await deployment.patch(manifest);
      return {
        ready: false,
        syncing: true,
        reason: 'UpdatingManifest',
      };
    }
    return {
      ready: true,
    };
  };

  #reconcileService = async (): Promise<SubresourceResult> => {
    const service = this.#resources.service;
    const manifest = serviceManifest({
      name: this.name,
      owner: this.ref,
    });
    if (!isDeepSubset(service.spec, manifest.spec)) {
      await service.patch(manifest);
      return {
        ready: false,
        syncing: true,
        reason: 'UpdatingManifest',
      };
    }
    return {
      ready: true,
    };
  };

  #reconcileConnection = async (): Promise<SubresourceResult> => {
    const connection = this.#resources.connection;
    const manifest = connectionManifest({
      name: this.name,
      owner: this.ref,
    });
    if (!isDeepSubset(connection.spec, manifest.spec)) {
      await connection.patch(manifest);
      return {
        ready: false,
        syncing: true,
        reason: 'UpdatingManifest',
      };
    }
    return {
      ready: true,
    };
  };

  public reconcile = async () => {
    await Promise.allSettled([
      this.reconcileSubresource('PVC', this.#reconcilePvc),
      this.reconcileSubresource('Deployment', this.#reconcileDeployment),
      this.reconcileSubresource('Service', this.#reconcileService),
      this.reconcileSubresource('Connection', this.#reconcileConnection),
    ]);
  };
}

export { PostgresClusterResource };
