import { z } from 'zod';

const authentikServerSpecSchema = z.object({
  postgresCluster: z.string(),
  environment: z.string(),
  subdomain: z.string(),
});

const authentikServerInitSecretSchema = z.object({
  AUTHENTIK_BOOTSTRAP_TOKEN: z.string(),
  AUTHENTIK_BOOTSTRAP_PASSWORD: z.string(),
  AUTHENTIK_BOOTSTRAP_EMAIL: z.string(),
  AUTHENTIK_SECRET_KEY: z.string(),
});

const authentikServerSecretSchema = z.object({
  url: z.string(),
  host: z.string(),
  token: z.string(),
});

export { authentikServerSpecSchema, authentikServerInitSecretSchema, authentikServerSecretSchema };
