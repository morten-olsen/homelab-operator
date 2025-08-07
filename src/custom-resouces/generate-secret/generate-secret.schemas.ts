import { z } from 'zod';

const generateSecretFieldSchema = z.object({
  name: z.string(),
  value: z.string().optional(),
  encoding: z.enum(['base64', 'base64url', 'hex', 'utf8', 'numeric']).optional(),
  length: z.number().optional(),
});

const generateSecretSpecSchema = z.object({
  fields: z.array(generateSecretFieldSchema),
});

type GenerateSecretField = z.infer<typeof generateSecretFieldSchema>;
type GenerateSecretSpec = z.infer<typeof generateSecretSpecSchema>;

export { generateSecretSpecSchema, type GenerateSecretField, type GenerateSecretSpec };
