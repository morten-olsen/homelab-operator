import type { V1Secret } from '@kubernetes/client-node';
import type { z } from 'zod';
import deepEqual from 'deep-equal';

import {
  CustomResource,
  type CustomResourceObject,
  type CustomResourceOptions,
  type SubresourceResult,
} from '../../services/custom-resources/custom-resources.custom-resource.ts';
import { ResourceReference } from '../../services/resources/resources.ref.ts';
import { ResourceService, type Resource } from '../../services/resources/resources.ts';
import { getWithNamespace } from '../../utils/naming.ts';
import type { authentikServerSpecSchema } from '../authentik-server/authentik-server.scemas.ts';
import type { domainSpecSchema } from '../domain/domain.schemas.ts';
import { decodeSecret, encodeSecret } from '../../utils/secrets.ts';
import { API_VERSION, CONTROLLED_LABEL } from '../../utils/consts.ts';

import { authentikClientSecretSchema, type authentikClientSpecSchema } from './authentik-client.schemas.ts';

class AuthentikClientResource extends CustomResource<typeof authentikClientSpecSchema> {
  #serverResource: ResourceReference<CustomResourceObject<typeof authentikServerSpecSchema>>;
  #serverSecretResource: ResourceReference<V1Secret>;
  #domainResource: ResourceReference<CustomResourceObject<typeof domainSpecSchema>>;
  #clientSecretResource: Resource<V1Secret>;

  constructor(options: CustomResourceOptions<typeof authentikClientSpecSchema>) {
    super(options);
    const resourceService = this.services.get(ResourceService);

    this.#serverResource = new ResourceReference();
    this.#serverSecretResource = new ResourceReference();
    this.#domainResource = new ResourceReference();
    this.#clientSecretResource = resourceService.get({
      apiVersion: 'v1',
      kind: 'Secret',
      name: `authentik-client-${this.name}`,
      namespace: this.namespace,
    });

    this.#updateResouces();

    this.#serverResource.on('changed', this.queueReconcile);
    this.#serverSecretResource.on('changed', this.queueReconcile);
    this.#domainResource.on('changed', this.queueReconcile);
    this.#clientSecretResource.on('changed', this.queueReconcile);
  }

  get server() {
    return this.#serverResource.current;
  }

  get serverSecret() {
    return this.#serverSecretResource.current;
  }

  get serverSecretValue() {
    return decodeSecret(this.#serverSecretResource.current?.data);
  }

  get domain() {
    return this.#domainResource.current;
  }

  get clientSecret() {
    return this.#clientSecretResource;
  }

  get clientSecretValue() {
    const values = decodeSecret(this.#clientSecretResource.data);
    const parsed = authentikClientSecretSchema.safeParse(values);
    if (!parsed.success) {
      return undefined;
    }
    return parsed.data;
  }

  #updateResouces = () => {
    const serverNames = getWithNamespace(this.spec.server, this.namespace);
    const resourceService = this.services.get(ResourceService);
    this.#serverResource.current = resourceService.get({
      apiVersion: API_VERSION,
      kind: 'AuthentikServer',
      name: serverNames.name,
      namespace: serverNames.namespace,
    });
    this.#serverSecretResource.current = resourceService.get({
      apiVersion: 'v1',
      kind: 'Secret',
      name: `authentik-server-${serverNames.name}`,
      namespace: serverNames.namespace,
    });
    const server = this.#serverResource.current;
    if (server && server.spec) {
      const domainNames = getWithNamespace(server.spec.domain, server.namespace);
      this.#domainResource.current = resourceService.get({
        apiVersion: API_VERSION,
        kind: 'Domain',
        name: domainNames.name,
        namespace: domainNames.namespace,
      });
    } else {
      this.#domainResource.current = undefined;
    }
  };

  #reconcileClientSecret = async (): Promise<SubresourceResult> => {
    const domain = this.domain;
    const server = this.server;
    const serverSecret = this.serverSecret;
    if (!server?.exists || !server?.spec || !serverSecret?.exists || !serverSecret.data) {
      return {
        ready: false,
        failed: true,
        message: 'Server or server secret not found',
      };
    }
    if (!domain?.exists || !domain?.spec) {
      return {
        ready: false,
        failed: true,
        message: 'Domain not found',
      };
    }
    const url = `https://authentik.${domain.spec?.hostname}`;
    const appName = this.name;
    const values = this.clientSecretValue;
    const expectedValues: Omit<z.infer<typeof authentikClientSecretSchema>, 'clientSecret'> = {
      clientId: this.name,
      configuration: new URL(`/application/o/${appName}/.well-known/openid-configuration`, url).toString(),
      configurationIssuer: new URL(`/application/o/${appName}/`, url).toString(),
      authorization: new URL(`/application/o/${appName}/authorize/`, url).toString(),
      token: new URL(`/application/o/${appName}/token/`, url).toString(),
      userinfo: new URL(`/application/o/${appName}/userinfo/`, url).toString(),
      endSession: new URL(`/application/o/${appName}/end-session/`, url).toString(),
      jwks: new URL(`/application/o/${appName}/jwks/`, url).toString(),
    };
    if (!values) {
      await this.clientSecret.patch({
        metadata: {
          ownerReferences: [this.ref],
          labels: {
            ...CONTROLLED_LABEL,
          },
        },
        data: encodeSecret({
          ...expectedValues,
          clientSecret: crypto.randomUUID(),
        }),
      });
      return {
        ready: false,
        syncing: true,
        message: 'UpdatingManifest',
      };
    }
    const compareData = {
      ...values,
      clientSecret: undefined,
    };
    if (!deepEqual(compareData, expectedValues)) {
      await this.clientSecret.patch({
        metadata: {
          ownerReferences: [this.ref],
          labels: {
            ...CONTROLLED_LABEL,
          },
        },
        data: encodeSecret(expectedValues),
      });
    }
    return {
      ready: true,
    };
  };

  public reconcile = async () => {
    if (!this.exists || this.metadata.deletionTimestamp) {
      return;
    }
    this.#updateResouces();
    await Promise.all([this.reconcileSubresource('Secret', this.#reconcileClientSecret)]);

    const secretReady = this.conditions.get('Secret')?.status === 'True';

    await this.conditions.set('Ready', {
      status: secretReady ? 'True' : 'False',
    });
  };
}

export { AuthentikClientResource };
