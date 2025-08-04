import type { KubernetesObject } from '@kubernetes/client-node';
import deepEqual from 'deep-equal';

import type { K8SGatewayV1 } from '../../__generated__/resources/K8SGatewayV1.ts';
import {
  CustomResource,
  type CustomResourceOptions,
  type SubresourceResult,
} from '../../services/custom-resources/custom-resources.custom-resource.ts';
import { ResourceReference, ResourceService } from '../../services/resources/resources.ts';
import type { K8SCertificateV1 } from '../../__generated__/resources/K8SCertificateV1.ts';
import { IstioService } from '../../services/istio/istio.ts';

import type { domainSpecSchema } from './domain.schemas.ts';
import { createCertificateManifest, createGatewayManifest } from './domain.create-manifests.ts';

class DomainResource extends CustomResource<typeof domainSpecSchema> {
  #gatewayCrdResource = new ResourceReference();
  #gatewayResource = new ResourceReference<KubernetesObject & K8SGatewayV1>();
  #certificateCrdResource = new ResourceReference();
  #certificateResource = new ResourceReference<KubernetesObject & K8SCertificateV1>();

  constructor(options: CustomResourceOptions<typeof domainSpecSchema>) {
    super(options);
    const resourceService = this.services.get(ResourceService);
    const istioService = this.services.get(IstioService);

    this.#gatewayCrdResource.current = resourceService.get({
      apiVersion: 'apiextensions.k8s.io/v1',
      kind: 'CustomResourceDefinition',
      name: 'gateways.networking.istio.io',
    });
    this.#gatewayResource.current = resourceService.get({
      apiVersion: 'networking.istio.io/v1',
      kind: 'Gateway',
      name: this.name,
      namespace: this.namespace,
    });

    this.#certificateCrdResource.current = resourceService.get({
      apiVersion: 'apiextensions.k8s.io/v1',
      kind: 'CustomResourceDefinition',
      name: 'certificates.cert-manager.io',
    });

    this.#certificateResource.current = resourceService.get({
      apiVersion: 'cert-manager.io/v1',
      kind: 'Certificate',
      name: `domain-${this.name}`,
      namespace: 'istio-ingress',
    });

    this.#gatewayResource.on('changed', this.queueReconcile);
    this.#certificateResource.on('changed', this.queueReconcile);
    this.#gatewayCrdResource.on('changed', this.queueReconcile);
    this.#certificateCrdResource.on('changed', this.queueReconcile);

    istioService.gateway.on('changed', this.queueReconcile);
  }

  get #certSecret() {
    return `cert-secret-${this.namespace}-${this.name}`;
  }

  #reconcileGateway = async (): Promise<SubresourceResult> => {
    if (!this.#gatewayCrdResource.current?.exists) {
      return {
        ready: false,
        failed: true,
        reason: 'MissingCRD',
        message: 'Missing Gateway CRD',
      };
    }
    const istioService = this.services.get(IstioService);
    if (!istioService.gateway.current) {
      return {
        ready: false,
        failed: true,
        reason: 'MissingGatewayController',
        message: 'No istio gateway controller could be found',
      };
    }
    const manifest = createGatewayManifest({
      name: this.name,
      namespace: this.name,
      domain: this.spec.hostname,
      ref: this.ref,
      gateway: istioService.gateway.current.metadata?.labels?.istio || 'ingress',
      secretName: this.#certSecret,
    });
    if (!deepEqual(this.#gatewayResource.current?.spec, manifest.spec)) {
      await this.#gatewayResource.current?.patch(manifest);
      return {
        ready: false,
        syncing: true,
        reason: 'ChangingGateway',
        message: 'Gateway need changes',
      };
    }
    return {
      ready: true,
    };
  };

  #reconcileCertificate = async (): Promise<SubresourceResult> => {
    if (!this.#certificateCrdResource.current?.exists) {
      return {
        ready: false,
        syncing: false,
        failed: true,
        reason: 'MissingCRD',
        message: 'Missing Certificate CRD',
      };
    }
    const current = this.#certificateResource.current;
    if (!current || !current.namespace) {
      throw new Error('Missing certificate resource');
    }
    const istioService = this.services.get(IstioService);
    if (!istioService.gateway.current) {
      return {
        ready: false,
        syncing: false,
        failed: true,
        reason: 'MissingGatewayController',
        message: 'No istio gateway controller could be found',
      };
    }
    const manifest = createCertificateManifest({
      name: current.name,
      namespace: istioService.gateway.current.namespace || 'default',
      domain: this.spec.hostname,
      secretName: this.#certSecret,
      issuer: this.spec.issuer,
    });
    if (!this.#certificateResource.current?.exists) {
      await current.patch(manifest);
      return {
        ready: false,
        syncing: true,
        reason: 'Creating',
        message: 'Creating certificate resource',
      };
    }
    if (!deepEqual(current.spec, manifest.spec)) {
      await this.conditions.set('CertificateReady', {
        status: 'False',
        reason: 'Changing',
        message: 'Certificate need changes',
      });
      await current.patch(manifest);
    }
    return {
      ready: true,
    };
  };

  public reconcile = async () => {
    if (!this.exists || this.metadata.deletionTimestamp) {
      return;
    }
    await this.reconcileSubresource('Gateway', this.#reconcileGateway);
    await this.reconcileSubresource('Certificate', this.#reconcileCertificate);

    const gatewayReady = this.conditions.get('Gateway')?.status === 'True';
    const certificateReady = this.conditions.get('Certificate')?.status === 'True';

    await this.conditions.set('Ready', {
      status: gatewayReady && certificateReady ? 'True' : 'False',
    });
  };
}

export { DomainResource };
