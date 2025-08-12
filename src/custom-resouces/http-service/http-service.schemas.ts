import { z } from 'zod';

const httpServiceSpecSchema = z.object({
  environment: z.string(),
  subdomain: z.string(),
  destination: z.object({
    host: z.string(),
    port: z
      .object({
        number: z.number().optional(),
        protocol: z.enum(['http', 'https']).optional(),
        name: z.string().optional(),
      })
      .optional(),
  }),
});

export { httpServiceSpecSchema };
