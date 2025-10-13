import {
  CustomResource,
  ResourceReference,
  ResourceService,
  type CustomResourceOptions,
} from '#services/resources/resources.ts';
import { ClientTypeEnum, SubModeEnum } from '@goauthentik/api';
import { z } from 'zod';
import { Environment } from '../environment/environment.ts';
import { API_VERSION } from '#utils/consts.ts';
import { NotReadyError } from '#utils/errors.ts';
import { Secret } from '#resources/core/secret/secret.ts';
import { generateRandomHexPass } from '#utils/secrets.ts';
import { AuthentikService } from '#services/authentik/authentik.service.ts';

const specSchema = z.object({
  environment: z.string(),
  subMode: z.enum(SubModeEnum).optional(),
  clientType: z.enum(ClientTypeEnum).optional(),
  redirectUris: z.array(
    z.object({
      subdomain: z.string(),
      path: z.string(),
      matchingMode: z.enum(['strict', 'regex']),
    }),
  ),
});

type SecretData = {
  clientId: string;
  clientSecret?: string;
  configuration: string;
  configurationIssuer: string;
  authorization: string;
  token: string;
  userinfo: string;
  endSession: string;
  jwks: string;
};
class OIDCClient extends CustomResource<typeof specSchema> {
  public static readonly apiVersion = API_VERSION;
  public static readonly kind = 'OidcClient';
  public static readonly spec = specSchema;
  public static readonly scope = 'Namespaced';

  #environment = new ResourceReference<typeof Environment>();
  #secret: Secret<SecretData>;

  constructor(options: CustomResourceOptions<typeof specSchema>) {
    super(options);
    const resourceService = this.services.get(ResourceService);
    this.#secret = resourceService.get(Secret<SecretData>, `${this.name}-client`, this.namespace);
  }

  public get appName() {
    return this.name;
  }

  public reconcile = async () => {
    if (!this.spec) {
      throw new NotReadyError('MissingSpec');
    }
    const resourceService = this.services.get(ResourceService);
    this.#environment.current = resourceService.get(Environment, this.spec.environment);
    if (!this.#environment.current.exists) {
      throw new NotReadyError('EnvironmentNotFound');
    }
    const authentik = this.#environment.current.authentikServer;
    const authentikSecret = authentik.secret.value;
    if (!authentikSecret) {
      throw new Error('MissingAuthentikSecret');
    }

    const url = authentik.url;

    await this.#secret.set((current) => ({
      clientSecret: generateRandomHexPass(),
      ...current,
      clientId: this.name,
      configuration: new URL(`/application/o/${this.appName}/.well-known/openid-configuration`, url).toString(),
      configurationIssuer: new URL(`/application/o/${this.appName}/`, url).toString(),
      authorization: new URL(`/application/o/authorize/`, url).toString(),
      token: new URL(`/application/o/${this.appName}/token/`, url).toString(),
      userinfo: new URL(`/application/o/${this.appName}/userinfo/`, url).toString(),
      endSession: new URL(`/application/o/${this.appName}/end-session/`, url).toString(),
      jwks: new URL(`/application/o/${this.appName}/jwks/`, url).toString(),
    }));

    const secret = this.#secret.value;
    if (!secret) {
      throw new NotReadyError('MissingSecret');
    }
    const authentikService = this.services.get(AuthentikService);
    const authentikServer = await authentikService.get({
      url: {
        internal: `http://${authentikSecret.host}`,
        external: authentikSecret.url,
      },
      token: authentikSecret.token,
    });

    const redirectUris = this.spec.redirectUris.map((uri) => ({
      matchingMode: uri.matchingMode,
      url: new URL(uri.path, `https://${uri.subdomain}.${this.#environment.current?.spec?.domain}`).toString(),
    }));

    await authentikServer.upsertClient({
      ...this.spec,
      redirectUris,
      name: this.name,
      secret: secret.clientSecret,
    });
  };
}

export { OIDCClient };
