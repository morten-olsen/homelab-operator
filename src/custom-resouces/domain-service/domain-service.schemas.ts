import { z } from 'zod';

const domainServiceSpecSchema = z.object({
  domain: z.string(),
  subdomain: z.string(),
  destination: z.object({
    host: z.string(),
    port: z.object({
      number: z.number().optional(),
      name: z.string().optional(),
    }),
  }),
});

export { domainServiceSpecSchema };
