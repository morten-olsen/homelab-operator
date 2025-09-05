import type { KubernetesObject, V1Secret } from '@kubernetes/client-node';

import { Resource } from '#services/resources/resources.ts';
import { decodeSecret, encodeSecret } from '#utils/secrets.ts';

type SetOptions<T extends Record<string, string | undefined>> = T | ((current: T | undefined) => T | Promise<T>);

class Secret<T extends Record<string, string> = Record<string, string>> extends Resource<V1Secret> {
  public static readonly apiVersion = 'v1';
  public static readonly kind = 'Secret';

  public get value() {
    return decodeSecret(this.data) as T | undefined;
  }

  public set = async (options: SetOptions<T>, data?: KubernetesObject) => {
    const value = typeof options === 'function' ? await Promise.resolve(options(this.value)) : options;
    await this.ensure({
      ...data,
      data: encodeSecret(value),
    });
  };
}

export { Secret };
