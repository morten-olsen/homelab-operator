import { z } from 'zod';

const authentikServerSpecSchema = z.object({
  domain: z.string(),
  subdomain: z.string(),
  database: z.string(),
  redis: z.string(),
});

const authentikServerSecretSchema = z.object({
  secret: z.string(),
  password: z.string(),
  token: z.string(),
});

export { authentikServerSpecSchema, authentikServerSecretSchema };
