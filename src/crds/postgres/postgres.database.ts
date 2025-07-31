import { z } from 'zod';

import { CustomResource, type CustomResourceHandlerOptions } from '../../custom-resource/custom-resource.base.ts';
import { PostgresService } from '../../services/postgres/postgres.service.ts';

const postgresDatabaseSpecSchema = z.object({});

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

  public update = async (options: CustomResourceHandlerOptions<typeof postgresDatabaseSpecSchema>) => {
    const { request, services, ensureSecret } = options;
    const variables = await ensureSecret({
      name: `postgres-database-${request.metadata.name}`,
      namespace: request.metadata.namespace ?? 'default',
      schema: z.object({
        name: z.string(),
        user: z.string(),
        password: z.string(),
      }),
      generator: async () => ({
        name: `${request.metadata.namespace || 'default'}_${request.metadata.name}`,
        user: `${request.metadata.namespace || 'default'}_${request.metadata.name}`,
        password: `password_${Buffer.from(crypto.getRandomValues(new Uint8Array(12))).toString('hex')}`,
      }),
    });
    const postgresService = services.get(PostgresService);
    await postgresService.upsertRole({
      name: variables.user,
      password: variables.password,
    });

    await postgresService.upsertDatabase({
      name: variables.name,
      owner: variables.user,
    });

    await request.addEvent({
      type: 'Normal',
      reason: 'DatabaseUpserted',
      message: 'Database has been upserted',
      action: 'UPSERT',
    });
  };
}

export { PostgresDatabase };
