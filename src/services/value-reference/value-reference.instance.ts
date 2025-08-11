import { z } from 'zod';
import { V1Secret } from '@kubernetes/client-node';
import { EventEmitter } from 'eventemitter3';
import deepEqual from 'deep-equal';

import { ResourceReference, ResourceService } from '../resources/resources.ts';
import type { Services } from '../../utils/service.ts';
import { getWithNamespace } from '../../utils/naming.ts';
import { decodeSecret } from '../../utils/secrets.ts';

const valueReferenceInfoSchema = z.object({
  value: z.string().optional(),
  secretRef: z.string().optional(),
  key: z.string().optional(),
});

type ValueReferenceInfo = z.infer<typeof valueReferenceInfoSchema>;

type ValueRefOptions = {
  services: Services;
  namespace: string;
};

type ValueReferenceEvents = {
  changed: () => void;
};
class ValueReference extends EventEmitter<ValueReferenceEvents> {
  #options: ValueRefOptions;
  #ref?: ValueReferenceInfo;
  #resource: ResourceReference;

  constructor(options: ValueRefOptions) {
    super();
    this.#options = options;
    this.#resource = new ResourceReference<V1Secret>();
    this.#resource.on('changed', this.#handleChange);
  }

  public get ref() {
    return this.#ref;
  }

  public set ref(ref: ValueReferenceInfo | undefined) {
    if (deepEqual(this.#ref, ref)) {
      return;
    }
    if (ref?.secretRef && ref.key) {
      const { services, namespace } = this.#options;
      const resourceService = services.get(ResourceService);
      const refNames = getWithNamespace(ref.secretRef, namespace);
      this.#resource.current = resourceService.get({
        apiVersion: 'v1',
        kind: 'Secret',
        name: refNames.name,
        namespace: refNames.namespace,
      });
    } else {
      this.#resource.current = undefined;
    }
    this.#ref = ref;
  }

  public get value() {
    console.log('get', this.#ref);
    if (!this.#ref) {
      return undefined;
    }
    if (this.#ref.value) {
      return this.#ref.value;
    }
    if (this.#resource.current && this.#ref.key) {
      const decoded = decodeSecret(this.#resource.current.data);
      return decoded?.[this.#ref.key];
    }
    return undefined;
  }

  #handleChange = () => {
    this.emit('changed');
  };
}

export { ValueReference, valueReferenceInfoSchema, type ValueReferenceInfo };
