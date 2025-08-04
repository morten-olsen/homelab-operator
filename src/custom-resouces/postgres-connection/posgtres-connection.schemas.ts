import { z } from 'zod';

const postgresConnectionSpecSchema = z.object({
  secret: z.string(),
});

const postgresConnectionSecretDataSchema = z.object({
  host: z.string(),
  port: z.string().optional(),
  user: z.string(),
  password: z.string(),
});

export { postgresConnectionSpecSchema, postgresConnectionSecretDataSchema };
