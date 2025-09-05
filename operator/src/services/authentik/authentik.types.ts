import type { ClientTypeEnum, SubModeEnum } from '@goauthentik/api';

type AuthentikServerInfo = {
  url: {
    internal: string;
    external: string;
  };
  token: string;
};

type UpsertClientRequest = {
  name: string;
  secret?: string;
  scopes?: string[];
  flows?: {
    authorization: string;
    invalidation: string;
  };
  clientType?: ClientTypeEnum;
  subMode?: SubModeEnum;
  redirectUris: {
    url: string;
    matchingMode: 'strict' | 'regex';
  }[];
  timing?: {
    accessCodeValidity?: string;
    accessTokenValidity?: string;
    refreshTokenValidity?: string;
  };
};

type UpsertGroupRequest = {
  name: string;
  attributes?: Record<string, string[]>;
};

export type { AuthentikServerInfo, UpsertClientRequest, UpsertGroupRequest };
