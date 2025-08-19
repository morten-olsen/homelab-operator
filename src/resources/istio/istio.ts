import { DestinationRule } from './destination-rule/destination-rule.ts';
import { Gateway } from './gateway/gateway.ts';
import { VirtualService } from './virtual-service/virtual-service.ts';

const istio = {
  gateway: Gateway,
  destinationRule: DestinationRule,
  virtualService: VirtualService,
};

export { istio };
