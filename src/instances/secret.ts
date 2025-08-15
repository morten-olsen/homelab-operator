import type { V1Secret } from '@kubernetes/client-node';
import type { z, ZodObject } from 'zod';

import { ResourceInstance } from '../services/resources/resources.instance.ts';
import { decodeSecret, encodeSecret } from '../utils/secrets.ts';

class SecretInstance<T extends ZodObject = ExpectedAny> extends ResourceInstance<V1Secret> {
  public get values() {
    return decodeSecret(this.data) as z.infer<T>;
  }

  public ensureData = async (values: z.infer<T>) => {
    await this.ensure({
      data: encodeSecret(values as Record<string, string>),
    });
  };

  public get ready() {
    return this.exists;
  }
}

export { SecretInstance };
