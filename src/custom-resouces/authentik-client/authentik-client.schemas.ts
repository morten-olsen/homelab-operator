import { ClientTypeEnum, MatchingModeEnum, SubModeEnum } from '@goauthentik/api';
import { z } from 'zod';

const authentikClientSpecSchema = z.object({
  server: z.string(),
  subMode: z.enum(SubModeEnum).optional(),
  clientType: z.enum(ClientTypeEnum).optional(),
  redirectUris: z.array(
    z.object({
      url: z.string(),
      matchingMode: z.enum(MatchingModeEnum).optional(),
    }),
  ),
});

const authentikClientSecretSchema = z.object({
  clientId: z.string(),
  clientSecret: z.string().optional(),
  configuration: z.string(),
  configurationIssuer: z.string(),
  authorization: z.string(),
  token: z.string(),
  userinfo: z.string(),
  endSession: z.string(),
  jwks: z.string(),
});

export { authentikClientSpecSchema, authentikClientSecretSchema };
