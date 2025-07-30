import {
  Configuration,
  CoreApi,
  FlowsApi,
  PropertymappingsApi,
  ProvidersApi,
  instanceOfErrorDetail,
} from '@goauthentik/api';

type CreateAuthentikClientOptions = {
  baseUrl: string;
  token: string;
};
const createAuthentikClient = ({ baseUrl, token }: CreateAuthentikClientOptions) => {
  const config = new Configuration({
    basePath: baseUrl,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const client = {
    core: new CoreApi(config),
    providers: new ProvidersApi(config),
    propertymappings: new PropertymappingsApi(config),
    flows: new FlowsApi(config),
  };

  return client;
};

type AuthentikClient = ReturnType<typeof createAuthentikClient>;

export { createAuthentikClient, type AuthentikClient, instanceOfErrorDetail };
