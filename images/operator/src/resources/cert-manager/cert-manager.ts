import { Certificate } from './certificate/certificate.ts';

import type { ResourceClass } from '#services/resources/resources.ts';

const certManager = {
  certificate: Certificate,
} satisfies Record<string, ResourceClass<ExpectedAny>>;

export { certManager };
