import { z } from 'zod';

const homelabSpecSchema = z.object({
  storage: z
    .object({
      enabled: z.boolean(),
      path: z.string(),
    })
    .optional(),
});

const homelabSecretSchema = z.object({
  postgresPassword: z.string(),
  redisPassword: z.string(),
});

export { homelabSpecSchema, homelabSecretSchema };
