import { z } from 'zod';

const postgresClusterSpecSchema = z.object({
  environment: z.string(),
  storage: z
    .object({
      size: z.string().optional(),
    })
    .optional(),
});

const postgresClusterSecretSchema = z.object({
  database: z.string(),
  host: z.string(),
  port: z.string(),
  username: z.string(),
  password: z.string(),
});

export { postgresClusterSpecSchema, postgresClusterSecretSchema };
