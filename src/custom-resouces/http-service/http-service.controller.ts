import { DestinationRuleInstance } from '../../instances/destination-rule.ts';
import { VirtualServiceInstance } from '../../instances/virtual-service.ts';
import {
  CustomResource,
  type CustomResourceObject,
  type CustomResourceOptions,
} from '../../services/custom-resources/custom-resources.custom-resource.ts';
import { ResourceReference, ResourceService } from '../../services/resources/resources.ts';
import { API_VERSION } from '../../utils/consts.ts';
import { getWithNamespace } from '../../utils/naming.ts';
import { environmentSpecSchema } from '../environment/environment.schemas.ts';

import { httpServiceSpecSchema } from './http-service.schemas.ts';

class HttpServiceController extends CustomResource<typeof httpServiceSpecSchema> {
  #environment: ResourceReference<CustomResourceObject<typeof environmentSpecSchema>>;
  #virtualService: VirtualServiceInstance;
  #destinationRule: DestinationRuleInstance;

  constructor(options: CustomResourceOptions<typeof httpServiceSpecSchema>) {
    super(options);
    const resourceService = this.services.get(ResourceService);
    this.#environment = new ResourceReference();
    this.#virtualService = resourceService.getInstance(
      {
        apiVersion: 'networking.istio.io/v1beta1',
        kind: 'VirtualService',
        name: `${this.name}-virtual-service`,
        namespace: this.namespace,
      },
      VirtualServiceInstance,
    );
    this.#destinationRule = resourceService.getInstance(
      {
        apiVersion: 'networking.istio.io/v1beta1',
        kind: 'DestinationRule',
        name: `${this.name}-destination-rule`,
        namespace: this.namespace,
      },
      DestinationRuleInstance,
    );
    this.#destinationRule.on('changed', this.queueReconcile);
    this.#virtualService.on('changed', this.queueReconcile);
    this.#environment.on('changed', this.queueReconcile);
  }

  public reconcile = async () => {
    if (!this.exists || this.metadata?.deletionTimestamp) {
      return;
    }
    const resourceService = this.services.get(ResourceService);
    const environmentNames = getWithNamespace(this.spec.environment, this.namespace);
    this.#environment.current = resourceService.get({
      apiVersion: API_VERSION,
      kind: 'Environment',
      name: environmentNames.name,
      namespace: environmentNames.namespace,
    });
    const environment = this.#environment.current;
    if (!environment?.exists) {
      return;
    }
    await this.#virtualService.ensure({
      metadata: {
        ownerReferences: [this.ref],
      },
      spec: {
        hosts: [`${this.spec.subdomain}.${environment.spec?.domain}`],
        gateways: [`${this.#environment.current.namespace}/gateway`],
        http: [
          {
            route: [
              {
                destination: {
                  host: this.spec.destination.host,
                  port: this.spec.destination.port,
                },
              },
            ],
          },
        ],
      },
    });
    await this.#destinationRule.ensure({
      metadata: {
        ownerReferences: [this.ref],
      },
      spec: {
        host: this.spec.destination.host,
        trafficPolicy: {
          tls: {
            mode: 'DISABLE',
          },
        },
      },
    });
  };
}

export { HttpServiceController };
