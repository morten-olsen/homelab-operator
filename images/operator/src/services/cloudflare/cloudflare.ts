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

  public ensureTunnel = async (route: string) => {
    const secret = this.#secret.value;
    if (!secret) {
      return;
    }
    const client = this.client;
    const domainParts = route.split('.');
    const cname = `${secret.tunnelId}.cfargotunnel.com`;
    const tld = domainParts.pop();
    const root = domainParts.pop();
    const zoneName = `${root}.${tld}`;
    const name = domainParts.join('.');

    const zones = await client.zones.list({
      name: zoneName,
    });
    const [zone] = zones.result;
    if (!zone) {
      return;
    }
    const records = await client.dns.records.list({
      zone_id: zone.id,
      name: {
        exact: route,
      },
      type: 'CNAME',
    });
    const [record] = records.result;
    if (record) {
      await client.dns.records.edit(record.id, {
        zone_id: zone.id,
        type: 'CNAME',
        content: cname,
        name: name,
        ttl: 1,
        proxied: true,
      });
    } else {
      await client.dns.records.create({
        zone_id: zone.id,
        type: 'CNAME',
        content: cname,
        name: name,
        ttl: 1,
        proxied: true,
      });
    }
  };
}

export { CloudflareService };
