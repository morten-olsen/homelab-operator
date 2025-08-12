import type { V1Secret } from '@kubernetes/client-node';
import type { z } from 'zod';

import {
  CustomResource,
  type CustomResourceOptions,
  type SubresourceResult,
} from '../../services/custom-resources/custom-resources.custom-resource.ts';
import { ResourceReference } from '../../services/resources/resources.ref.ts';
import { ResourceService, type Resource } from '../../services/resources/resources.ts';
import { getWithNamespace } from '../../utils/naming.ts';
import { decodeSecret, encodeSecret } from '../../utils/secrets.ts';
import { CONTROLLED_LABEL } from '../../utils/consts.ts';
import { isDeepSubset } from '../../utils/objects.ts';
import { AuthentikService } from '../../services/authentik/authentik.service.ts';
import { authentikServerSecretSchema } from '../authentik-server/authentik-server.schemas.ts';

import { authentikClientSecretSchema, type authentikClientSpecSchema } from './authentik-client.schemas.ts';

class AuthentikClientResource extends CustomResource<typeof authentikClientSpecSchema> {
  #serverSecret: ResourceReference<V1Secret>;
  #clientSecretResource: Resource<V1Secret>;

  constructor(options: CustomResourceOptions<typeof authentikClientSpecSchema>) {
    super(options);
    const resourceService = this.services.get(ResourceService);

    this.#serverSecret = new ResourceReference();
    this.#clientSecretResource = resourceService.get({
      apiVersion: 'v1',
      kind: 'Secret',
      name: `authentik-client-${this.name}`,
      namespace: this.namespace,
    });

    this.#updateResouces();

    this.#serverSecret.on('changed', this.queueReconcile);
    this.#clientSecretResource.on('changed', this.queueReconcile);
  }

  #updateResouces = () => {
    const serverSecretNames = getWithNamespace(`${this.spec.server}-server`, this.namespace);
    const resourceService = this.services.get(ResourceService);
    this.#serverSecret.current = resourceService.get({
      apiVersion: 'v1',
      kind: 'Secret',
      name: serverSecretNames.name,
      namespace: serverSecretNames.namespace,
    });
  };

  #reconcileClientSecret = async (): Promise<SubresourceResult> => {
    const serverSecret = this.#serverSecret.current;
    if (!serverSecret?.exists || !serverSecret.data) {
      return {
        ready: false,
        failed: true,
        message: 'Server or server secret not found',
      };
    }
    const serverSecretData = authentikServerSecretSchema.safeParse(decodeSecret(serverSecret.data));
    if (!serverSecretData.success || !serverSecretData.data) {
      return {
        ready: false,
        failed: true,
        message: 'Server secret not found',
      };
    }
    const url = serverSecretData.data.url;
    const appName = this.name;
    const clientSecretData = authentikClientSecretSchema.safeParse(decodeSecret(this.#clientSecretResource.data));

    const expectedValues: z.infer<typeof authentikClientSecretSchema> = {
      clientId: this.name,
      clientSecret: clientSecretData.data?.clientSecret || crypto.randomUUID(),
      configuration: new URL(`/application/o/${appName}/.well-known/openid-configuration`, url).toString(),
      configurationIssuer: new URL(`/application/o/${appName}/`, url).toString(),
      authorization: new URL(`/application/o/${appName}/authorize/`, url).toString(),
      token: new URL(`/application/o/${appName}/token/`, url).toString(),
      userinfo: new URL(`/application/o/${appName}/userinfo/`, url).toString(),
      endSession: new URL(`/application/o/${appName}/end-session/`, url).toString(),
      jwks: new URL(`/application/o/${appName}/jwks/`, url).toString(),
    };
    if (!isDeepSubset(clientSecretData.data, expectedValues)) {
      await this.#clientSecretResource.patch({
        metadata: {
          ownerReferences: [this.ref],
          labels: {
            ...CONTROLLED_LABEL,
          },
        },
        data: encodeSecret(expectedValues),
      });
      return {
        ready: false,
        syncing: true,
        message: 'UpdatingManifest',
      };
    }
    return {
      ready: true,
    };
  };

  #reconcileServer = async (): Promise<SubresourceResult> => {
    const serverSecret = this.#serverSecret.current;
    const clientSecret = this.#clientSecretResource;

    if (!serverSecret?.exists || !serverSecret.data) {
      return {
        ready: false,
        failed: true,
        message: 'Server secret not found',
      };
    }

    const serverSecretData = authentikServerSecretSchema.safeParse(decodeSecret(serverSecret.data));
    if (!serverSecretData.success || !serverSecretData.data) {
      return {
        ready: false,
        failed: true,
        message: 'Server secret not found',
      };
    }

    const clientSecretData = authentikClientSecretSchema.safeParse(decodeSecret(clientSecret.data));
    if (!clientSecretData.success || !clientSecretData.data) {
      return {
        ready: false,
        failed: true,
        message: 'Client secret not found',
      };
    }

    const authentikService = this.services.get(AuthentikService);
    const authentikServer = authentikService.get({
      url: {
        internal: `http://${serverSecretData.data.host}`,
        external: serverSecretData.data.url,
      },
      token: serverSecretData.data.token,
    });

    (await authentikServer).upsertClient({
      ...this.spec,
      name: this.name,
      secret: clientSecretData.data.clientSecret,
    });

    return {
      ready: true,
    };
  };

  public reconcile = async () => {
    if (!this.exists || this.metadata?.deletionTimestamp) {
      return;
    }
    this.#updateResouces();
    await Promise.all([
      this.reconcileSubresource('Secret', this.#reconcileClientSecret),
      this.reconcileSubresource('Server', this.#reconcileServer),
    ]);

    const secretReady = this.conditions.get('Secret')?.status === 'True';
    const serverReady = this.conditions.get('Server')?.status === 'True';

    await this.conditions.set('Ready', {
      status: secretReady && serverReady ? 'True' : 'False',
    });
  };
}

export { AuthentikClientResource };
