import type { V1Secret } from '@kubernetes/client-node';

import { ResourceInstance } from '../services/resources/resources.instance.ts';
import { decodeSecret, encodeSecret } from '../utils/secrets.ts';

class SecretInstance extends ResourceInstance<V1Secret> {
  public get values() {
    return decodeSecret(this.data);
  }

  public ensureData = async (values: Record<string, string>) => {
    await this.ensure({
      data: encodeSecret(values),
    });
  };

  public readonly ready = true;
}

export { SecretInstance };
