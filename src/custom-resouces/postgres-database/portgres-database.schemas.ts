import { z } from 'zod';

const postgresDatabaseSpecSchema = z.object({
  secretRef: z.string(),
});

const postgresDatabaseSecretSchema = z.object({
  host: z.string(),
  port: z.string(),
  user: z.string(),
  password: z.string(),
  database: z.string().optional(),
});

const postgresDatabaseConnectionSecretSchema = z.object({
  host: z.string(),
  port: z.string(),
  user: z.string(),
  password: z.string(),
  database: z.string(),
});

export { postgresDatabaseSpecSchema, postgresDatabaseSecretSchema, postgresDatabaseConnectionSecretSchema };
