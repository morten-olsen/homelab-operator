import { core } from './core/core.ts';
import { flux } from './flux/flux.ts';
import { homelab } from './homelab/homelab.ts';
import { certManager } from './cert-manager/cert-manager.ts';
import { istio } from './istio/istio.ts';

import type { ResourceClass } from '#services/resources/resources.ts';

const resources = {
  ...core,
  ...flux,
  ...certManager,
  ...istio,
  // ...homelab,
} satisfies Record<string, ResourceClass<ExpectedAny>>;

export { resources };
