import type { Static, TSchema } from "@sinclair/typebox";
import type { Services } from "../utils/service.ts";
import { K8sService } from "../services/k8s.ts";
import { CustomResourceRegistry } from "./custom-resource.registry.ts";
import { CustomResourceStatus, type CustomResourceStatusType } from "./custom-resource.status.ts";
import { ApiException, PatchStrategy, setHeaderOptions } from "@kubernetes/client-node";

type CustomResourceRequestOptions = {
  type: 'ADDED' | 'DELETED' | 'MODIFIED';
  manifest: any;
  services: Services;
};

type CustomResourceRequestMetadata = Record<string, string> & {
  name: string;
  namespace?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  uid: string;
  resourceVersion: string;
  creationTimestamp: string;
  generation: number;
};

class CustomResourceRequest<TSpec extends TSchema>{
  #options: CustomResourceRequestOptions;

  constructor(options: CustomResourceRequestOptions) {
    this.#options = options;
  }

  public get services(): Services {
    return this.#options.services;
  }

  public get type(): 'ADDED' | 'DELETED' | 'MODIFIED' {
    return this.#options.type;
  }

  public get manifest() {
    return this.#options.manifest;
  }

  public get kind(): string {
    return this.#options.manifest.kind;
  }

  public get apiVersion(): string {
    return this.#options.manifest.apiVersion;
  }

  public get spec(): Static<TSpec> {
    return this.#options.manifest.spec;
  }

  public get metadata(): CustomResourceRequestMetadata {
    return this.#options.manifest.metadata;
  }

  public isOwnerOf = (manifest: any) => {
    const ownerRef = manifest?.metadata?.ownerReferences || [];
    return ownerRef.some((ref: any) => 
      ref.apiVersion === this.apiVersion &&
      ref.kind === this.kind &&
      ref.name === this.metadata.name &&
      ref.uid === this.metadata.uid
    );
  }

  public setStatus = async (status: CustomResourceStatusType) => {
    const { manifest, services } = this.#options;
    const { kind, metadata } = manifest;
    const registry = services.get(CustomResourceRegistry);  
    const crd = registry.getByKind(kind);
    if (!crd) {
      throw new Error(`Custom resource ${kind} not found`);
    }

    const k8sService = services.get(K8sService);

    const { namespace = 'default', name } = metadata;

    const response = await k8sService.customObjectsApi.patchNamespacedCustomObjectStatus({
      group: crd.group,
      version: crd.version,
      namespace,
      plural: crd.names.plural,
      name,
      body: { status },
      fieldValidation: 'Strict',
    }, setHeaderOptions('Content-Type', PatchStrategy.MergePatch))
    return response;
  }

  public getCurrent = async () => {
    const { manifest, services } = this.#options;
    const k8sService = services.get(K8sService);
    const registry = services.get(CustomResourceRegistry);
    const crd = registry.getByKind(manifest.kind);
    if (!crd) {
      throw new Error(`Custom resource ${manifest.kind} not found`);
    }
    try {
    const resource = await k8sService.customObjectsApi.getNamespacedCustomObject({
      group: crd.group,
      version: crd.version,
      plural: crd.names.plural,
      namespace: manifest.metadata.namespace,
      name: manifest.metadata.name,
    });
    return resource as {
      apiVersion: string;
      kind: string;
      metadata: CustomResourceRequestMetadata;
      spec: Static<TSpec>;
      status: CustomResourceStatusType;
      };
    } catch (error) {
      if (error instanceof ApiException && error.code === 404) {
        return undefined;
      }
      throw error;
    }
  }

  public getStatus = async () => {
    const resource = await this.getCurrent()
    if (!resource || !resource.status) {
      return new CustomResourceStatus({
        status: {
          observedGeneration: 0,
          conditions: [],
        },
        generation: 0,
        save: this.setStatus,
      });
    }
    return new CustomResourceStatus({
      status: { ...resource.status, observedGeneration: resource.status.observedGeneration },
      generation: resource.metadata.generation,
      save: this.setStatus,
    });
  }
  
}

export { CustomResourceRequest };