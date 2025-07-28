import { type Static, type TSchema } from "@sinclair/typebox";
import { GROUP } from "../utils/consts.ts";
import type { Services } from "../utils/service.ts";
import { statusSchema } from "./custom-resource.status.ts";
import type { CustomResourceRequest } from "./custom-resource.request.ts";


type CustomResourceHandlerOptions<TSpec extends TSchema> = {
  request: CustomResourceRequest<TSpec>;
  services: Services;
}

type CustomResourceConstructor<TSpec extends TSchema> = {
  kind: string;
  spec: TSpec;
  names: {
    plural: string;
    singular: string;
  };
}

abstract class CustomResource<
  TSpec extends TSchema
> {
  #options: CustomResourceConstructor<TSpec>;

  constructor(options: CustomResourceConstructor<TSpec>) {
    this.#options = options;
  }

  public get name() {
    return `${this.#options.names.plural}.${this.group}`;
  }

  public get version() {
    return 'v1';
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

  public abstract update(options: CustomResourceHandlerOptions<TSpec>): Promise<void>;
  public create?(options: CustomResourceHandlerOptions<TSpec>): Promise<void>;
  public delete?(options: CustomResourceHandlerOptions<TSpec>): Promise<void>;

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
        versions: [{
          name: this.version,
          served: true,
          storage: true,
          schema: {
            openAPIV3Schema: {
              type: 'object',
              properties: {
                spec: this.spec,
                status: statusSchema as any,
              }
            }
          },
          subresources: {
            status: {}
          }
        }]
      }
    }
  }
}


export { CustomResource, type CustomResourceConstructor, type CustomResourceHandlerOptions };