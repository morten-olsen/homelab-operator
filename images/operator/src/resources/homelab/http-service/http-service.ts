import { VirtualService } from '#resources/istio/virtual-service/virtual-service.ts';
import {
  CustomResource,
  ResourceReference,
  ResourceService,
  type CustomResourceOptions,
} from '#services/resources/resources.ts';
import { z } from 'zod';
import { Environment } from '../environment/environment.ts';
import { NotReadyError } from '#utils/errors.ts';
import { API_VERSION } from '#utils/consts.ts';

const specSchema = z.object({
  environment: z.string(),
  subdomain: z.string(),
  destination: z.object({
    host: z.string(),
    port: z.object({
      number: z.number().optional(),
      name: z.string().optional(),
    }),
  }),
});

class HttpService extends CustomResource<typeof specSchema> {
  public static readonly apiVersion = API_VERSION;
  public static readonly kind = 'HttpService';
  public static readonly spec = specSchema;
  public static readonly scope = 'Namespaced';

  #virtualService: VirtualService;
  #environment: ResourceReference<typeof Environment>;

  constructor(options: CustomResourceOptions<typeof specSchema>) {
    super(options);

    const resourceService = this.services.get(ResourceService);
    this.#virtualService = resourceService.get(VirtualService, this.name, this.namespace);
    this.#virtualService.on('changed', this.queueReconcile);

    this.#environment = new ResourceReference();
    this.#environment.on('changed', this.queueReconcile);
  }

  public reconcile = async () => {
    if (!this.spec) {
      throw new NotReadyError('MissingSpec');
    }
    const resourceService = this.services.get(ResourceService);

    this.#environment.current = resourceService.get(Environment, this.spec.environment);
    const env = this.#environment.current;
    if (!env.exists) {
      throw new NotReadyError('MissingEnvironment');
    }
    const gateway = env.gateway;
    const domain = env.spec?.domain;
    if (!domain) {
      throw new NotReadyError('MissingDomain');
    }
    const host = `${this.spec.subdomain}.${domain}`;
    this.#virtualService.ensure({
      metadata: {
        ownerReferences: [this.ref],
      },
      spec: {
        hosts: [host, 'mesh'],
        gateways: [`${gateway.namespace}/${gateway.name}`, 'mesh'],
        http: [
          {
            route: [
              {
                destination: this.spec.destination,
              },
            ],
          },
        ],
      },
    });
  };
}

export { HttpService };
