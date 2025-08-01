import { z } from 'zod';

const authentikServerSpecSchema = z.object({
  domain: z.object({
    name: z.string(),
    namespace: z.string().optional(),
  }),
  subdomain: z.string(),
});

type AuthentikServerSpec = z.infer<typeof authentikServerSpecSchema>;

export { authentikServerSpecSchema, type AuthentikServerSpec };
