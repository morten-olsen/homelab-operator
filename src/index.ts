import { ResourceService } from './services/resources/resources.ts';
import { Services } from './utils/service.ts';
import { BootstrapService } from './bootstrap/bootstrap.ts';

import { resources } from '#resources/resources.ts';
import { homelab } from '#resources/homelab/homelab.ts';

const services = new Services();
const resourceService = services.get(ResourceService);

await resourceService.install(...Object.values(homelab));
await resourceService.register(...Object.values(resources));

const bootstrapService = services.get(BootstrapService);
await bootstrapService.ensure();

console.log('Started');
