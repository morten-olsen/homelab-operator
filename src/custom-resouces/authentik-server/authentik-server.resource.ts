import type { V1Service, V1Deployment, V1Secret } from '@kubernetes/client-node';
import { z } from 'zod';
import deepEqual from 'deep-equal';

import {
  CustomResource,
  type CustomResourceObject,
  type CustomResourceOptions,
  type SubresourceResult,
} from '../../services/custom-resources/custom-resources.custom-resource.ts';
import { ResourceReference } from '../../services/resources/resources.ref.ts';
import { ResourceService, type Resource } from '../../services/resources/resources.ts';
import type { domainSpecSchema } from '../domain/domain.schemas.ts';
import type { domainServiceSpecSchema } from '../domain-service/domain-service.schemas.ts';
import type { EnsuredSecret } from '../../services/secrets/secrets.secret.ts';
import { getWithNamespace } from '../../utils/naming.ts';
import { API_VERSION } from '../../utils/consts.ts';
import { SecretService } from '../../services/secrets/secrets.ts';
import { decodeSecret } from '../../utils/secrets.ts';
import type { postgresDatabaseSecretSchema } from '../postgres-database/postgres-database.resource.ts';
import type { redisConnectionSpecSchema } from '../redis-connection/redis-connection.schemas.ts';

import { authentikServerSecretSchema, type authentikServerSpecSchema } from './authentik-server.scemas.ts';
import { createDomainService, createManifest, createServiceManifest } from './authentik-server.create-manifests.ts';

class AuthentikServerResource extends CustomResource<typeof authentikServerSpecSchema> {
  #domainResource: ResourceReference<CustomResourceObject<typeof domainSpecSchema>>;
  #databaseSecretResource: ResourceReference<V1Secret>;
  #redisResource: ResourceReference<CustomResourceObject<typeof redisConnectionSpecSchema>>;
  #redisSecretResource: ResourceReference<V1Secret>;
  #deploymentServerResource: Resource<V1Deployment>;
  #deploymentWorkerResource: Resource<V1Deployment>;
  #service: Resource<V1Service>;
  #domainServiceResource: Resource<CustomResourceObject<typeof domainServiceSpecSchema>>;
  #secret: EnsuredSecret<typeof authentikServerSecretSchema>;

  constructor(options: CustomResourceOptions<typeof authentikServerSpecSchema>) {
    super(options);
    const domainNames = getWithNamespace(this.spec.domain, this.namespace);
    const databaseNames = getWithNamespace(this.spec.database, this.namespace);

    const resourceService = this.services.get(ResourceService);
    const secretService = this.services.get(SecretService);

    this.#domainResource = new ResourceReference();
    this.#databaseSecretResource = new ResourceReference();
    this.#redisResource = new ResourceReference();
    this.#redisSecretResource = new ResourceReference();

    this.#deploymentServerResource = resourceService.get({
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      name: this.#serverName,
      namespace: this.namespace,
    });

    this.#deploymentWorkerResource = resourceService.get({
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      name: this.#workerName,
      namespace: this.namespace,
    });

    this.#domainServiceResource = resourceService.get({
      apiVersion: API_VERSION,
      kind: 'DomainService',
      name: this.name,
      namespace: this.namespace,
    });

    this.#service = resourceService.get({
      apiVersion: 'v1',
      kind: 'Service',
      name: this.name,
      namespace: this.namespace,
    });

    this.#secret = secretService.ensure({
      name: this.name,
      namespace: this.namespace,
      schema: authentikServerSecretSchema,
      generator: () => ({
        secret: crypto.randomUUID(),
        token: crypto.randomUUID(),
        password: crypto.randomUUID(),
      }),
    });

    this.#domainServiceResource = resourceService.get({
      apiVersion: API_VERSION,
      kind: 'DomainService',
      name: this.name,
      namespace: this.namespace,
    });

    this.#updateResources();

    this.#domainResource.on('changed', this.queueReconcile);
    this.#databaseSecretResource.on('changed', this.queueReconcile);
    this.#redisResource.on('changed', this.queueReconcile);
    this.#redisSecretResource.on('changed', this.queueReconcile);
    this.#deploymentServerResource.on('changed', this.queueReconcile);
    this.#deploymentWorkerResource.on('changed', this.queueReconcile);
    this.#domainServiceResource.on('changed', this.queueReconcile);
    this.#service.on('changed', this.queueReconcile);
    this.#secret.resouce.on('changed', this.queueReconcile);
  }

  get #databaseSecretName() {
    const { name } = getWithNamespace(this.spec.database);
    return `postgres-database-${name}`;
  }

  get #workerName() {
    return `${this.name}-worker`;
  }

  get #serverName() {
    return `${this.name}-server`;
  }

  #updateResources = () => {
    if (!this.isValidSpec) {
      return;
    }
    const resourceService = this.services.get(ResourceService);
    const redisNames = getWithNamespace(this.spec.redis, this.namespace);
    const redisResource = resourceService.get<CustomResourceObject<typeof redisConnectionSpecSchema>>({
      apiVersion: API_VERSION,
      kind: 'RedisConnection',
      name: redisNames.name,
      namespace: redisNames.namespace,
    });
    this.#redisResource.current = redisResource;
    const redis = this.#redisResource.current;

    if (redis.exists && redis.spec) {
      const redisSecretNames = getWithNamespace(redis.spec.secret, redis.namespace);
      this.#redisSecretResource.current = resourceService.get({
        apiVersion: 'v1',
        kind: 'Secret',
        name: redisSecretNames.name,
        namespace: redisSecretNames.namespace,
      });
    } else {
      this.#redisSecretResource.current = undefined;
    }

    const domainNames = getWithNamespace(this.spec.domain, this.namespace);
    const databaseNames = getWithNamespace(this.spec.database, this.namespace);

    this.#domainResource.current = resourceService.get({
      apiVersion: API_VERSION,
      kind: 'Domain',
      name: domainNames.name,
      namespace: domainNames.namespace,
    });

    this.#databaseSecretResource.current = resourceService.get({
      apiVersion: 'v1',
      kind: 'Secret',
      name: this.#databaseSecretName,
      namespace: databaseNames.namespace,
    });
  };

  #reconcileWorkerDeployment = async (): Promise<SubresourceResult> => {
    const domainService = this.#domainResource.current;
    if (!domainService?.exists || !domainService.spec) {
      return {
        ready: false,
        failed: true,
        reason: 'MissingDomain',
      };
    }
    const databaseSecret = decodeSecret<z.infer<typeof postgresDatabaseSecretSchema>>(
      this.#databaseSecretResource.current?.data,
    );
    if (!databaseSecret) {
      return {
        ready: false,
        failed: true,
        reason: 'MissingDatabase',
      };
    }
    const secret = this.#secret.value;
    if (!this.#secret.isValid || !secret) {
      return {
        ready: false,
        syncing: true,
        reason: 'WaitingForSecret',
      };
    }

    const redisSecret = decodeSecret(this.#redisSecretResource.current?.data);
    if (!redisSecret || !redisSecret.host) {
      return {
        ready: false,
        failed: true,
        reason: 'MissingRedisSecret',
      };
    }

    const email = `admin@${domainService.spec.hostname}`;
    const manifest = createManifest({
      name: this.#workerName,
      namespace: this.namespace,
      secret: secret.secret,
      command: 'worker',
      owner: this.ref,
      bootstrap: {
        email,
        token: secret.token,
        password: secret.password,
      },
      redis: {
        host: redisSecret.host,
        port: redisSecret.port ?? '6379',
      },
      posgtres: {
        host: databaseSecret.host,
        port: databaseSecret.port || '5432',
        name: databaseSecret.database,
        user: databaseSecret.user,
        password: databaseSecret.password,
      },
    });
    if (!deepEqual(this.#deploymentWorkerResource.spec, manifest.spec)) {
      await this.#deploymentWorkerResource.patch(manifest);
      return {
        ready: false,
        syncing: true,
        reason: 'ManifestNeedsPatching',
      };
    }
    return {
      ready: true,
    };
  };

  #reconcileServerDeployment = async (): Promise<SubresourceResult> => {
    const domainService = this.#domainResource.current;
    if (!domainService?.exists || !domainService.spec) {
      return {
        ready: false,
        failed: true,
        reason: 'MissingDomain',
      };
    }
    const databaseSecret = decodeSecret<z.infer<typeof postgresDatabaseSecretSchema>>(
      this.#databaseSecretResource.current?.data,
    );
    if (!databaseSecret) {
      return {
        ready: false,
        failed: true,
        reason: 'MissingDatabase',
      };
    }
    const secret = this.#secret.value;
    if (!this.#secret.isValid || !secret) {
      return {
        ready: false,
        syncing: true,
        reason: 'WaitingForSecret',
      };
    }

    const redisSecret = decodeSecret(this.#redisSecretResource.current?.data);
    if (!redisSecret || !redisSecret.host) {
      return {
        ready: false,
        failed: true,
        reason: 'MissingRedisSecret',
      };
    }

    const email = `admin@${domainService.spec.hostname}`;
    const manifest = createManifest({
      name: this.#serverName,
      namespace: this.namespace,
      secret: secret.secret,
      command: 'server',
      owner: this.ref,
      bootstrap: {
        email,
        token: secret.token,
        password: secret.password,
      },
      redis: {
        host: redisSecret.host,
        port: redisSecret.port ?? '6379',
      },
      posgtres: {
        host: databaseSecret.host,
        port: databaseSecret.port || '5432',
        name: databaseSecret.database,
        user: databaseSecret.user,
        password: databaseSecret.password,
      },
    });
    if (!deepEqual(this.#deploymentServerResource.spec, manifest.spec)) {
      await this.#deploymentServerResource.patch(manifest);
      return {
        ready: false,
        syncing: true,
        reason: 'ManifestNeedsPatching',
      };
    }
    return {
      ready: true,
    };
  };

  #reconcileService = async (): Promise<SubresourceResult> => {
    const manifest = createServiceManifest({
      name: this.name,
      namespace: this.namespace,
      owner: this.ref,
      appName: this.#serverName,
    });

    if (!deepEqual(this.#service.manifest, manifest.spec)) {
      await this.#service.patch(manifest);
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

  #reconcileDomainService = async (): Promise<SubresourceResult> => {
    const manifest = createDomainService({
      name: this.name,
      namespace: this.namespace,
      owner: this.ref,
      domain: this.spec.domain,
      host: `${this.name}.${this.namespace}.svc.cluster.local`,
      subdomain: 'authentik',
    });
    if (!deepEqual(manifest.spec, this.#domainServiceResource.spec)) {
      await this.#domainServiceResource.patch(manifest);
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
    if (!this.isValidSpec) {
      await this.conditions.set('Ready', {
        status: 'False',
        reason: 'Invalid spec',
      });
    }
    this.#updateResources();

    await Promise.allSettled([
      this.reconcileSubresource('Worker', this.#reconcileWorkerDeployment),
      this.reconcileSubresource('Server', this.#reconcileServerDeployment),
      this.reconcileSubresource('Service', this.#reconcileService),
      this.reconcileSubresource('DomainService', this.#reconcileDomainService),
    ]);

    const workerReady = this.conditions.get('Worker')?.status === 'True';
    const serverReady = this.conditions.get('Server')?.status === 'True';
    const serviceReady = this.conditions.get('Service')?.status === 'True';
    const domainServiceReady = this.conditions.get('DomainService')?.status === 'True';

    await this.conditions.set('Ready', {
      status: workerReady && serverReady && serviceReady && domainServiceReady ? 'True' : 'False',
    });
  };
}

export { AuthentikServerResource };
