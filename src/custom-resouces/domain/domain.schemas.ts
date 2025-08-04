import { z } from 'zod';

const domainSpecSchema = z.object({
  hostname: z.string(),
  issuer: z.string(),
});

export { domainSpecSchema };
