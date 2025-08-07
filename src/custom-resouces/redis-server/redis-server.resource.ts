import type { V1Deployment, V1Service } from '@kubernetes/client-node';

import {
  type CustomResourceOptions,
  CustomResource,
  type CustomResourceObject,
} from '../../services/custom-resources/custom-resources.custom-resource.ts';
import {
  redisConnectionSecretDataSchema,
  redisConnectionSpecSchema,
} from '../redis-connection/redis-connection.schemas.ts';
import { Resource, ResourceService } from '../../services/resources/resources.ts';
import { API_VERSION } from '../../utils/consts.ts';
import type { EnsuredSecret } from '../../services/secrets/secrets.secret.ts';
import { SecretService } from '../../services/secrets/secrets.ts';
import { isDeepSubset } from '../../utils/objects.ts';

import { redisServerSpecSchema } from './redis-server.schemas.ts';
import { connectionManifest, deploymentManifest, serviceManifest } from './redis-server.manifests.ts';

class RedisServerResource extends CustomResource<typeof redisServerSpecSchema> {
  #resources: {
    deployment: Resource<V1Deployment>;
    service: Resource<V1Service>;
    connection: Resource<CustomResourceObject<typeof redisConnectionSpecSchema>>;
    secret: EnsuredSecret<typeof redisConnectionSecretDataSchema>;
  };
  constructor(options: CustomResourceOptions<typeof redisServerSpecSchema>) {
    super(options);
    const resourceService = this.services.get(ResourceService);
    const secretService = this.services.get(SecretService);
    this.#resources = {
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
        kind: 'RedisConnection',
        name: this.name,
        namespace: this.namespace,
      }),
      secret: secretService.ensure({
        name: `${this.name}-connection`,
        namespace: this.namespace,
        schema: redisConnectionSecretDataSchema,
        generator: () => ({
          host: `${this.name}.${this.namespace}.svc.cluster.local`,
        }),
      }),
    };
  }

  #reconcileDeployment = async () => {
    const { deployment } = this.#resources;
    const manifest = deploymentManifest();
    if (!isDeepSubset(deployment.spec, manifest.spec)) {
      await deployment.patch(manifest);
      return {
        ready: false,
        syncing: true,
        reason: 'ChangingDeployment',
        message: 'Deployment need changes',
      };
    }
    return {
      ready: true,
      reason: 'DeploymentReady',
      message: 'Deployment is ready',
    };
  };

  #reconcileService = async () => {
    const { service } = this.#resources;
    const manifest = serviceManifest();
    if (!isDeepSubset(service.spec, manifest.spec)) {
      await service.patch(manifest);
      return {
        ready: false,
        syncing: true,
        reason: 'ChangingService',
        message: 'Service need changes',
      };
    }
    return {
      ready: true,
      reason: 'ServiceReady',
      message: 'Service is ready',
    };
  };

  #reconcileConnection = async () => {
    const { connection, secret } = this.#resources;
    if (!secret.isValid || !secret.value) {
      return {
        ready: false,
        failed: true,
        reason: 'MissingSecret',
        message: 'Secret is missing',
      };
    }
    const manifest = connectionManifest({
      secretName: secret.name,
    });
    if (!isDeepSubset(connection.spec, manifest.spec)) {
      await connection.patch(manifest);
      return {
        ready: false,
        syncing: true,
        reason: 'ChangingConnection',
        message: 'Connection need changes',
      };
    }
    return {
      ready: true,
      reason: 'ConnectionReady',
      message: 'Connection is ready',
    };
  };

  public reconcile = async () => {
    await Promise.allSettled([
      this.reconcileSubresource('Deployment', this.#reconcileDeployment),
      this.reconcileSubresource('Service', this.#reconcileService),
      this.reconcileSubresource('Connection', this.#reconcileConnection),
    ]);
  };
}

export { RedisServerResource };
