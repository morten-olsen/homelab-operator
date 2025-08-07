import type { V1Secret } from '@kubernetes/client-node';
import type { z, ZodObject } from 'zod';
import deepEqual from 'deep-equal';

import { ResourceService, type Resource } from '../resources/resources.ts';
import type { Services } from '../../utils/service.ts';

type EnsuredSecretOptions<T extends ZodObject> = {
  services: Services;
  name: string;
  namespace: string;
  schema: T;
  owner?: ExpectedAny[];
  generator: (previous?: unknown) => z.infer<T>;
  validate?: (value: T) => boolean;
};

class EnsuredSecret<T extends ZodObject> {
  #options: EnsuredSecretOptions<T>;
  #resource: Resource<V1Secret>;

  constructor(options: EnsuredSecretOptions<T>) {
    this.#options = options;
    const { services, name, namespace } = options;
    const resourceService = services.get(ResourceService);
    this.#resource = resourceService.get({
      apiVersion: 'v1',
      kind: 'Secret',
      name,
      namespace,
    });
    this.#resource.on('changed', this.#handleChanged);
    this.#handleChanged();
  }

  public get name() {
    return this.#options.name;
  }

  public get namespace() {
    return this.#options.namespace;
  }

  public get resouce() {
    return this.#resource;
  }

  public get value(): z.infer<T> | undefined {
    if (!this.#resource.data) {
      return undefined;
    }
    return Object.fromEntries(
      Object.entries(this.#resource.data).map(([name, value]) => [name, Buffer.from(value, 'base64').toString('utf8')]),
    ) as ExpectedAny;
  }

  public patch = async (value: ExpectedAny) => {
    const patched = {
      ...this.value,
      ...value,
    };
    if (deepEqual(patched, this.value)) {
      return;
    }
    await this.resouce.patch({
      data: patched,
    });
  };

  public get isValid() {
    const { schema, validate } = this.#options;
    const { success } = schema.safeParse(this.value);
    if (!success) {
      return false;
    }
    if (validate) {
      return validate(this.value as unknown as T);
    }
    return true;
  }

  #handleChanged = () => {
    const { generator, owner } = this.#options;
    if (this.isValid && deepEqual(this.#resource.metadata?.ownerReferences, owner)) {
      return;
    }
    const data = generator();
    const encodedValues = Object.fromEntries(
      Object.entries(data).map(([name, value]) => [name, Buffer.from(String(value)).toString('base64')]),
    );
    this.#resource.patch({
      metadata: {
        ownerReferences: owner,
      },
      data: encodedValues,
    });
  };
}

export { EnsuredSecret, type EnsuredSecretOptions };
