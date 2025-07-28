import { Type } from "@sinclair/typebox";
import { CustomResource, type CustomResourceHandlerOptions } from "../../custom-resource/custom-resource.base.ts";
import { K8sService } from "../../services/k8s.ts";
import { ApiException, type V1Secret } from "@kubernetes/client-node";
import type { CustomResourceRequest } from "../../custom-resource/custom-resource.request.ts";
import { PostgresService } from "../../services/postgres/postgres.service.ts";

const postgresDatabaseSpecSchema = Type.Object({
});

class PostgresDatabase extends CustomResource<typeof postgresDatabaseSpecSchema> {
  constructor() {
    super({
      kind: 'PostgresDatabase',
      spec: postgresDatabaseSpecSchema,
      names: {
        plural: 'postgresdatabases',
        singular: 'postgresdatabase',
      },
    });
  }

  #getVariables = async (request: CustomResourceRequest<typeof postgresDatabaseSpecSchema>) => {
    const { metadata, services } = request;
    const k8sService = services.get(K8sService);

    const secretName = `postgres-database-${metadata.name}`;
    let secret: V1Secret | undefined;

    try {
      secret = await k8sService.api.readNamespacedSecret({
        name: secretName,
        namespace: metadata.namespace ?? 'default',
      });
    } catch (error) {
      if (!(error instanceof ApiException && error.code === 404)) {
        throw error;
      }
    }

    if (secret && request.isOwnerOf(secret) && secret.data) {
      services.log.debug('PostgresRole secret found', { secret });
      return secret.data;
    }

    if (secret && !request.isOwnerOf(secret)) {
      throw new Error('The secret is not owned by this resource');
    }

    const data = {
      name: Buffer.from(`${metadata.namespace}_${metadata.name}`).toString('base64'),
      user: Buffer.from(metadata.name).toString('base64'),
      password: Buffer.from(crypto.randomUUID()).toString('base64'),
    }
    const namespace = metadata.namespace ?? 'default';

    services.log.debug('Creating secret', { data });
    const response = await k8sService.api.createNamespacedSecret({
      namespace,
      body: {
        kind: 'Secret',
        metadata: {
          name: secretName,
          namespace,
          ownerReferences: [
            {
              apiVersion: request.apiVersion,
              kind: request.kind,
              name: metadata.name,
              uid: metadata.uid,
            },
          ],
        },
        type: 'Opaque',
        data,
      },
    });
    services.log.debug('Secret created', { response });
    return response.data!;
  }

  public update = async (options: CustomResourceHandlerOptions<typeof postgresDatabaseSpecSchema>) => {
    const { request, services } = options;
    const status = await request.getStatus();

    try {
      const variables = await this.#getVariables(request);
      const postgresService = services.get(PostgresService);
      await postgresService.upsertRole({
        name: Buffer.from(variables.user!, 'base64').toString('utf-8'),
        password: Buffer.from(variables.password!, 'base64').toString('utf-8'),
      });

      await postgresService.upsertDatabase({
        name: Buffer.from(variables.name!, 'base64').toString('utf-8'),
        owner: Buffer.from(variables.user!, 'base64').toString('utf-8'),
      });

      status.setCondition('Ready', {
        status: 'True',
        reason: 'Ready',
        message: 'Role created',
      });
      services.log.info('PostgresRole updated', { status });
      return await status.save();
    } catch (error) {
      const status = await request.getStatus();
      status.setCondition('Ready', {
        status: 'False',
        reason: 'Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      services.log.error('Error updating PostgresRole', { error });
      return await status.save();
    }
  }
}

export { PostgresDatabase };