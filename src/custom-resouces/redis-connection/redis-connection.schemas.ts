import { z } from 'zod';

const redisConnectionSpecSchema = z.object({
  secret: z.string(),
});

const redisConnectionSecretDataSchema = z.object({
  host: z.string(),
  port: z.string().optional(),
  user: z.string().optional(),
  password: z.string().optional(),
});

export { redisConnectionSpecSchema, redisConnectionSecretDataSchema };
