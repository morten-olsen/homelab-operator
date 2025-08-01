import { z, type ZodObject } from 'zod';

import { GROUP } from '../utils/consts.ts';
import type { Services } from '../utils/service.ts';

import { customResourceStatusSchema, type CustomResourceRequest } from './custom-resource.request.ts';

type EnsureSecretOptions<T extends ZodObject> = {
  schema: T;
  name: string;
  namespace: string;
  generator: () => Promise<z.infer<T>>;
};

type CustomResourceHandlerOptions<TSpec extends ZodObject> = {
  request: CustomResourceRequest<TSpec>;
  ensureSecret: <T extends ZodObject>(options: EnsureSecretOptions<T>) => Promise<z.infer<T>>;
  services: Services;
};

type CustomResourceConstructor<TSpec extends ZodObject> = {
  kind: string;
  spec: TSpec;
  names: {
    plural: string;
    singular: string;
  };
};

abstract class CustomResource<TSpec extends ZodObject> {
  #options: CustomResourceConstructor<TSpec>;

  constructor(options: CustomResourceConstructor<TSpec>) {
    this.#options = options;
  }

  public readonly version = 'v1';

  public get name() {
    return `${this.#options.names.plural}.${this.group}`;
  }

  public get group() {
    return GROUP;
  }

  public get path() {
    return `/apis/${this.group}/v1/${this.#options.names.plural}`;
  }

  public get kind() {
    return this.#options.kind;
  }

  public get spec() {
    return this.#options.spec;
  }

  public get names() {
    return this.#options.names;
  }

  public update?(options: CustomResourceHandlerOptions<TSpec>): Promise<void>;
  public create?(options: CustomResourceHandlerOptions<TSpec>): Promise<void>;
  public delete?(options: CustomResourceHandlerOptions<TSpec>): Promise<void>;
  public reconcile?(options: CustomResourceHandlerOptions<TSpec>): Promise<void>;

  public toManifest = () => {
    return {
      apiVersion: 'apiextensions.k8s.io/v1',
      kind: 'CustomResourceDefinition',
      metadata: {
        name: this.name,
      },
      spec: {
        group: this.group,
        names: {
          kind: this.kind,
          plural: this.#options.names.plural,
          singular: this.#options.names.singular,
        },
        scope: 'Namespaced',
        versions: [
          {
            name: this.version,
            served: true,
            storage: true,
            schema: {
              openAPIV3Schema: {
                type: 'object',
                properties: {
                  spec: {
                    ...z.toJSONSchema(this.spec.strict(), { io: 'input' }),
                    $schema: undefined,
                    additionalProperties: undefined,
                  } as ExpectedAny,
                  status: {
                    ...z.toJSONSchema(customResourceStatusSchema.strict(), { io: 'input' }),
                    $schema: undefined,
                    additionalProperties: undefined,
                  } as ExpectedAny,
                },
              },
            },
            subresources: {
              status: {},
            },
          },
        ],
      },
    };
  };
}

const createCustomResource = <TSpec extends ZodObject>(
  options: CustomResourceConstructor<TSpec> & {
    update?: (options: CustomResourceHandlerOptions<TSpec>) => Promise<void>;
    create?: (options: CustomResourceHandlerOptions<TSpec>) => Promise<void>;
    delete?: (options: CustomResourceHandlerOptions<TSpec>) => Promise<void>;
  },
) => {
  return class extends CustomResource<TSpec> {
    constructor() {
      super(options);
    }

    public update = options.update;
    public create = options.create;
    public delete = options.delete;
  };
};

export {
  CustomResource,
  type CustomResourceConstructor,
  type CustomResourceHandlerOptions,
  type EnsureSecretOptions,
  createCustomResource,
};
