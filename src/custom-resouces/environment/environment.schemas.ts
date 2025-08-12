import { z } from 'zod';

const environmentSpecSchema = z.object({
  domain: z.string(),
  tls: z.object({
    issuer: z.string(),
  }),
  storage: z
    .object({
      location: z.string().optional(),
    })
    .optional(),
});

type EnvironmentSpec = z.infer<typeof environmentSpecSchema>;

export { environmentSpecSchema, type EnvironmentSpec };
