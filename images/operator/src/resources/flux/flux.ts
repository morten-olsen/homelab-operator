import { HelmRelease } from './helm-release/helm-release.ts';
import { HelmRepo } from './helm-repo/helm-repo.ts';

import type { ResourceClass } from '#services/resources/resources.ts';

const flux = {
  helmRelease: HelmRelease,
  helmRepo: HelmRepo,
} satisfies Record<string, ResourceClass<ExpectedAny>>;

export { flux };
