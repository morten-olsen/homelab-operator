import type { KubernetesObject } from '@kubernetes/client-node';
import deepEqual from 'deep-equal';

import type { K8SVirtualServiceV1 } from '../../__generated__/resources/K8SVirtualServiceV1.ts';
import {
  CustomResource,
  type CustomResourceObject,
  type CustomResourceOptions,
  type SubresourceResult,
} from '../../services/custom-resources/custom-resources.custom-resource.ts';
import { ResourceReference, ResourceService, type Resource } from '../../services/resources/resources.ts';
import type { K8SDestinationRuleV1 } from '../../__generated__/resources/K8SDestinationRuleV1.ts';
import type { domainSpecSchema } from '../domain/domain.schemas.ts';
import { getWithNamespace } from '../../utils/naming.ts';
import { GROUP } from '../../utils/consts.ts';

import type { domainServiceSpecSchema } from './domain-service.schemas.ts';
import { createDestinationRuleManifest, createVirtualServiceManifest } from './domain-service.create-manifests.ts';

const VIRTUAL_SERVICE_CONDITION = 'VirtualService';
const DESTINAION_RULE_CONDITION = 'DestinationRule';

class DomainServiceResource extends CustomResource<typeof domainServiceSpecSchema> {
  #virtualServiceResource: Resource<KubernetesObject & K8SVirtualServiceV1>;
  #virtualServiceCRDResource: Resource<KubernetesObject>;
  #destinationRuleResource: Resource<KubernetesObject & K8SDestinationRuleV1>;
  #destinationRuleCRDResource: Resource<KubernetesObject>;
  #domainResource: ResourceReference<CustomResourceObject<typeof domainSpecSchema>>;

  constructor(options: CustomResourceOptions<typeof domainServiceSpecSchema>) {
    super(options);
    const resourceService = this.services.get(ResourceService);
    this.#virtualServiceResource = resourceService.get({
      apiVersion: 'networking.istio.io/v1',
      kind: 'VirtualService',
      name: this.name,
      namespace: this.namespace,
    });

    this.#virtualServiceCRDResource = resourceService.get({
      apiVersion: 'apiextensions.k8s.io/v1',
      kind: 'CustomResourceDefinition',
      name: 'virtualservices.networking.istio.io',
    });

    this.#destinationRuleResource = resourceService.get({
      apiVersion: 'networking.istio.io/v1',
      kind: 'DestinationRule',
      name: this.name,
      namespace: this.namespace,
    });

    this.#destinationRuleCRDResource = resourceService.get({
      apiVersion: 'apiextensions.k8s.io/v1',
      kind: 'CustomResourceDefinition',
      name: 'destinationrules.networking.istio.io',
    });

    const gatewayNames = getWithNamespace(this.spec.domain);
    this.#domainResource = new ResourceReference(
      resourceService.get({
        apiVersion: `${GROUP}/v1`,
        kind: 'Domain',
        name: gatewayNames.name,
        namespace: gatewayNames.namespace,
      }),
    );

    this.#virtualServiceResource.on('changed', this.queueReconcile);
    this.#virtualServiceCRDResource.on('changed', this.queueReconcile);
    this.#destinationRuleResource.on('changed', this.queueReconcile);
    this.#destinationRuleCRDResource.on('changed', this.queueReconcile);
    this.#domainResource.on('changed', this.queueReconcile);
  }

  #reconcileVirtualService = async (): Promise<SubresourceResult> => {
    if (!this.#virtualServiceCRDResource.exists) {
      return {
        ready: false,
        failed: true,
        reason: 'MissingCRD',
      };
    }
    const domain = this.#domainResource.current;
    if (!domain?.exists || !domain.spec) {
      return {
        ready: false,
        failed: true,
        reason: 'MissingDomain',
      };
    }
    const manifest = createVirtualServiceManifest({
      name: this.name,
      namespace: this.namespace,
      gateway: `${domain.namespace}/${domain.name}`,
      owner: this.ref,
      host: `${this.spec.subdomain}.${domain.spec.hostname}`,
      destination: this.spec.destination,
    });

    if (!deepEqual(this.#virtualServiceResource.spec, manifest.spec)) {
      await this.#virtualServiceResource.patch(manifest);
      return {
        ready: false,
        syncing: true,
        reason: 'ManifestNeedsPatching',
      };
    }

    return {
      ready: true,
    };
  };

  #reconcileDestinationRule = async (): Promise<SubresourceResult> => {
    if (!this.#destinationRuleCRDResource.exists) {
      return {
        ready: false,
        failed: true,
        reason: 'MissingCRD',
      };
    }
    const manifest = createDestinationRuleManifest({
      name: this.name,
      namespace: this.namespace,
      host: this.spec.destination.host,
    });

    if (!deepEqual(this.#destinationRuleResource.spec, manifest.spec)) {
      await this.#destinationRuleResource.patch(manifest);
      return {
        ready: false,
        syncing: true,
        reason: 'ManifestNeedsPatching',
      };
    }

    return {
      ready: true,
    };
  };

  public reconcile = async () => {
    if (!this.exists || this.metadata.deletionTimestamp) {
      return;
    }
    const resourceService = this.services.get(ResourceService);
    const gatewayNames = getWithNamespace(this.spec.domain, this.namespace);

    this.#domainResource.current = resourceService.get({
      apiVersion: `${GROUP}/v1`,
      kind: 'Domain',
      name: gatewayNames.name,
      namespace: gatewayNames.namespace,
    });

    await this.reconcileSubresource(VIRTUAL_SERVICE_CONDITION, this.#reconcileVirtualService);
    await this.reconcileSubresource(DESTINAION_RULE_CONDITION, this.#reconcileDestinationRule);

    const virtualServiceReady = this.conditions.get(VIRTUAL_SERVICE_CONDITION)?.status === 'True';
    const destinationruleReady = this.conditions.get(DESTINAION_RULE_CONDITION)?.status === 'True';

    await this.conditions.set('Ready', {
      status: virtualServiceReady && destinationruleReady ? 'True' : 'False',
    });
  };
}

export { DomainServiceResource };
