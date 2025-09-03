import { Cloudflare } from 'cloudflare';
import { EventEmitter } from 'eventemitter3';

import { NamespaceService } from '#bootstrap/namespaces/namespaces.ts';
import { Secret } from '#resources/core/secret/secret.ts';
import { ResourceService } from '#services/resources/resources.ts';
import type { Services } from '#utils/service.ts';

type SecretData = {
  account: string;
  tunnelName: string;
  tunnelId: string;
  secret: string;
  token: string;
};

type CloudflareServiceEvents = {
  changed: () => void;
};

class CloudflareService extends EventEmitter<CloudflareServiceEvents> {
  #services: Services;
  #secret: Secret<SecretData>;

  constructor(services: Services) {
    super();
    this.#services = services;
    const resourceService = this.#services.get(ResourceService);
    const namespaceService = this.#services.get(NamespaceService);
    this.#secret = resourceService.get(Secret<SecretData>, 'cloudflare', namespaceService.homelab.name);

    this.#secret.on('changed', this.emit.bind(this, 'changed'));
  }

  public get secret() {
    return this.#secret.value;
  }

  public get ready() {
    return !!this.secret;
  }

  public get client() {
    const token = this.#secret.value?.token;
    if (!token) {
      throw new Error('Cloudflare API token is not set');
    }

    const client = new Cloudflare({
      apiToken: token,
    });

    return client;
  }
}

export { CloudflareService };
