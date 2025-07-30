import type { Services } from '../../utils/service.ts';
import { ConfigService } from '../config/config.ts';
import { createAuthentikClient, type AuthentikClient } from '../../clients/authentik/authentik.ts';

import type { UpsertClientRequest, UpsertGroupRequest } from './authentik.types.ts';

const DEFAULT_AUTHORIZATION_FLOW = 'default-provider-authorization-implicit-consent';
const DEFAULT_INVALIDATION_FLOW = 'default-invalidation-flow';
const DEFAULT_SCOPES = ['openid', 'email', 'profile', 'offline_access'];

class AuthentikService {
  #client: AuthentikClient;
  #services: Services;

  constructor(services: Services) {
    const config = services.get(ConfigService);
    this.#client = createAuthentikClient({
      baseUrl: new URL('api/v3', config.authentik.url).toString(),
      token: config.authentik.token,
    });
    this.#services = services;
  }

  public get url() {
    const config = this.#services.get(ConfigService);
    return config.authentik.url;
  }

  #upsertApplication = async (request: UpsertClientRequest, provider: number, pk?: string) => {
    if (!pk) {
      return await this.#client.core.coreApplicationsCreate({
        applicationRequest: {
          name: request.name,
          slug: request.name,
          provider,
        },
      });
    }
    return await this.#client.core.coreApplicationsUpdate({
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

    if (!pk) {
      return await this.#client.providers.providersOauth2Create({
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
    return await this.#client.providers.providersOauth2Update({
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
    const groups = await this.#client.core.coreGroupsList({
      search: name,
    });
    return groups.results.find((group) => group.name === name);
  };

  public getScopePropertyMappings = async () => {
    const mappings = await this.#client.propertymappings.propertymappingsProviderScopeList({});
    return mappings;
  };

  public getApplicationFromSlug = async (slug: string) => {
    const applications = await this.#client.core.coreApplicationsList({
      search: slug,
    });
    const application = applications.results.find((app) => app.slug === slug);
    return application;
  };

  public getProviderFromClientId = async (clientId: string) => {
    const providers = await this.#client.providers.providersOauth2List({
      clientId,
    });
    return providers.results.find((provider) => provider.clientId === clientId);
  };

  public getFlows = async () => {
    const flows = await this.#client.flows.flowsInstancesList();
    return flows;
  };

  public upsertClient = async (request: UpsertClientRequest) => {
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
          configuration: new URL(
            `/application/o/${provider.name}/.well-known/openid-configuration`,
            this.url,
          ).toString(),
          configurationIssuer: new URL(`/application/o/${provider.name}/`, this.url).toString(),
          authorization: new URL(`/application/o/${provider.name}/authorize/`, this.url).toString(),
          token: new URL(`/application/o/${provider.name}/token/`, this.url).toString(),
          userinfo: new URL(`/application/o/${provider.name}/userinfo/`, this.url).toString(),
          endSession: new URL(`/application/o/${provider.name}/end-session/`, this.url).toString(),
          jwks: new URL(`/application/o/${provider.name}/jwks/`, this.url).toString(),
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
    if (provider) {
      await this.#client.providers.providersOauth2Destroy({ id: provider.pk });
    }
    const application = await this.getApplicationFromSlug(name);
    if (application) {
      await this.#client.core.coreApplicationsDestroy({ slug: application.name });
    }
  };

  public upsertGroup = async (request: UpsertGroupRequest) => {
    const group = await this.getGroupFromName(request.name);
    if (!group) {
      await this.#client.core.coreGroupsCreate({
        groupRequest: {
          name: request.name,
          attributes: request.attributes,
        },
      });
    } else {
      await this.#client.core.coreGroupsUpdate({
        groupUuid: group.pk,
        groupRequest: {
          name: request.name,
          attributes: request.attributes,
        },
      });
    }
  };
}

export { AuthentikService };
