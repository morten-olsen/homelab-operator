import { createAuthentikClient, type AuthentikClient } from '../../clients/authentik/authentik.ts';
import type { Services } from '../../utils/service.ts';

import type { AuthentikServerInfo, UpsertClientRequest, UpsertGroupRequest } from './authentik.types.ts';

type AuthentikInstanceOptions = {
  info: AuthentikServerInfo;
  services: Services;
};

const DEFAULT_AUTHORIZATION_FLOW = 'default-provider-authorization-implicit-consent';
const DEFAULT_INVALIDATION_FLOW = 'default-invalidation-flow';
const DEFAULT_SCOPES = ['openid', 'email', 'profile', 'offline_access'];

class AuthentikInstance {
  #options: AuthentikInstanceOptions;
  #client: AuthentikClient;

  constructor(options: AuthentikInstanceOptions) {
    this.#options = options;
    const baseUrl = new URL('/api/v3', options.info.url.internal).toString();
    options.services.log.debug('Using Authentik base URL', { baseUrl });
    this.#client = createAuthentikClient({
      baseUrl,
      token: options.info.token,
    });
  }

  #upsertApplication = async (request: UpsertClientRequest, provider: number, pk?: string) => {
    const client = this.#client;
    if (!pk) {
      return await client.core.coreApplicationsCreate({
        applicationRequest: {
          name: request.name,
          slug: request.name,
          provider,
        },
      });
    }
    return await client.core.coreApplicationsUpdate({
      slug: request.name,
      applicationRequest: {
        name: request.name,
        slug: request.name,
        provider,
      },
    });
  };

  #upsertProvider = async (request: UpsertClientRequest, pk?: number) => {
    const flows = await this.getFlows();
    const authorizationFlow = flows.results.find(
      (flow) => flow.slug === (request.flows?.authorization ?? DEFAULT_AUTHORIZATION_FLOW),
    );
    const invalidationFlow = flows.results.find(
      (flow) => flow.slug === (request.flows?.invalidation ?? DEFAULT_INVALIDATION_FLOW),
    );
    if (!authorizationFlow || !invalidationFlow) {
      throw new Error('Authorization and invalidation flows not found');
    }
    const scopes = await this.getScopePropertyMappings();
    const scopePropertyMapping = (request.scopes ?? DEFAULT_SCOPES)
      .map((scope) => scopes.results.find((mapping) => mapping.scopeName === scope)?.pk)
      .filter(Boolean) as string[];

    const client = this.#client;

    if (!pk) {
      return await client.providers.providersOauth2Create({
        oAuth2ProviderRequest: {
          name: request.name,
          clientId: request.name,
          clientSecret: request.secret,
          redirectUris: request.redirectUris,
          authorizationFlow: authorizationFlow.pk,
          invalidationFlow: invalidationFlow.pk,
          propertyMappings: scopePropertyMapping,
          clientType: request.clientType,
          subMode: request.subMode,
          accessCodeValidity: request.timing?.accessCodeValidity,
          accessTokenValidity: request.timing?.accessTokenValidity,
          refreshTokenValidity: request.timing?.refreshTokenValidity,
        },
      });
    }
    return await client.providers.providersOauth2Update({
      id: pk,
      oAuth2ProviderRequest: {
        name: request.name,
        clientId: request.name,
        clientSecret: request.secret,
        redirectUris: request.redirectUris,
        authorizationFlow: authorizationFlow.pk,
        invalidationFlow: invalidationFlow.pk,
        propertyMappings: scopePropertyMapping,
        clientType: request.clientType,
        subMode: request.subMode,
        accessCodeValidity: request.timing?.accessCodeValidity,
        accessTokenValidity: request.timing?.accessTokenValidity,
        refreshTokenValidity: request.timing?.refreshTokenValidity,
      },
    });
  };

  public getGroupFromName = async (name: string) => {
    const client = this.#client;
    const groups = await client.core.coreGroupsList({
      search: name,
    });
    return groups.results.find((group) => group.name === name);
  };

  public getScopePropertyMappings = async () => {
    const client = this.#client;
    const mappings = await client.propertymappings.propertymappingsProviderScopeList({});
    return mappings;
  };

  public getApplicationFromSlug = async (slug: string) => {
    const client = this.#client;
    const applications = await client.core.coreApplicationsList({
      search: slug,
    });
    const application = applications.results.find((app) => app.slug === slug);
    return application;
  };

  public getProviderFromClientId = async (clientId: string) => {
    const client = this.#client;

    const providers = await client.providers.providersOauth2List({
      clientId,
    });
    return providers.results.find((provider) => provider.clientId === clientId);
  };

  public getFlows = async () => {
    const client = this.#client;
    const flows = await client.flows.flowsInstancesList();
    return flows;
  };

  public upsertClient = async (request: UpsertClientRequest) => {
    const url = this.#options.info.url.external;
    try {
      let provider = await this.getProviderFromClientId(request.name);
      provider = await this.#upsertProvider(request, provider?.pk);
      let application = await this.getApplicationFromSlug(request.name);
      application = await this.#upsertApplication(request, provider.pk, application?.pk);
      const config = {
        provider: {
          id: provider.pk,
          name: provider.name,
          clientId: provider.clientId,
          clientSecret: provider.clientSecret,
          clientType: provider.clientType,
          subMode: provider.subMode,
          redirectUris: provider.redirectUris,
          scopes: provider.propertyMappings,
          timing: {
            accessCodeValidity: provider.accessCodeValidity,
            accessTokenValidity: provider.accessTokenValidity,
            refreshTokenValidity: provider.refreshTokenValidity,
          },
        },
        application: {
          id: application.pk,
          name: application.name,
          slug: application.slug,
          provider: provider.pk,
        },
        urls: {
          configuration: new URL(`/application/o/${provider.name}/.well-known/openid-configuration`, url).toString(),
          configurationIssuer: new URL(`/application/o/${provider.name}/`, url).toString(),
          authorization: new URL(`/application/o/${provider.name}/authorize/`, url).toString(),
          token: new URL(`/application/o/${provider.name}/token/`, url).toString(),
          userinfo: new URL(`/application/o/${provider.name}/userinfo/`, url).toString(),
          endSession: new URL(`/application/o/${provider.name}/end-session/`, url).toString(),
          jwks: new URL(`/application/o/${provider.name}/jwks/`, url).toString(),
        },
      };
      return { provider, application, config };
    } catch (error: ExpectedAny) {
      if ('response' in error) {
        throw new Error(await error.response.text());
      }
      throw error;
    }
  };

  public deleteClient = async (name: string) => {
    const provider = await this.getProviderFromClientId(name);
    const client = this.#client;
    if (provider) {
      await client.providers.providersOauth2Destroy({ id: provider.pk });
    }
    const application = await this.getApplicationFromSlug(name);
    if (application) {
      await client.core.coreApplicationsDestroy({ slug: application.name });
    }
  };

  public upsertGroup = async (request: UpsertGroupRequest) => {
    const group = await this.getGroupFromName(request.name);
    const client = this.#client;
    if (!group) {
      await client.core.coreGroupsCreate({
        groupRequest: {
          name: request.name,
          attributes: request.attributes,
        },
      });
    } else {
      await client.core.coreGroupsUpdate({
        groupUuid: group.pk,
        groupRequest: {
          name: request.name,
          attributes: request.attributes,
        },
      });
    }
  };
}

export { AuthentikInstance, type AuthentikInstanceOptions };
