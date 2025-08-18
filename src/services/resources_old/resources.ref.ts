import type { KubernetesObject } from '@kubernetes/client-node';
import { EventEmitter } from 'eventemitter3';

import type { Resource } from './resources.ts';
import type { ResourceEvents } from './resources.resource.ts';

type ResourceReferenceEvents<T extends KubernetesObject> = ResourceEvents<T> & {
  replaced: (options: { previous: Resource<T> | undefined; next: Resource<T> | undefined }) => void;
};

class ResourceReference<T extends KubernetesObject = KubernetesObject> extends EventEmitter<
  ResourceReferenceEvents<T>
> {
  #current?: Resource<T>;
  #updatedEvent: ResourceEvents<T>['updated'];
  #changedEvent: ResourceEvents<T>['changed'];
  #changedMetadateEvent: ResourceEvents<T>['changedMetadate'];
  #changedSpecEvent: ResourceEvents<T>['changedSpec'];
  #changedStatusEvent: ResourceEvents<T>['changedStatus'];
  #deletedEvent: ResourceEvents<T>['deleted'];

  constructor(current?: Resource<T>) {
    super();
    this.#updatedEvent = this.emit.bind(this, 'updated');
    this.#changedEvent = this.emit.bind(this, 'changed');
    this.#changedMetadateEvent = this.emit.bind(this, 'changedMetadate');
    this.#changedSpecEvent = this.emit.bind(this, 'changedSpec');
    this.#changedStatusEvent = this.emit.bind(this, 'changedStatus');
    this.#deletedEvent = this.emit.bind(this, 'deleted');
    this.current = current;
  }

  public get services() {
    return this.#current?.services;
  }

  public get current() {
    return this.#current;
  }

  public set current(next: Resource<T> | undefined) {
    const previous = this.#current;
    if (next === previous) {
      return;
    }
    if (this.#current) {
      this.#current.off('updated', this.#updatedEvent);
      this.#current.off('changed', this.#changedEvent);
      this.#current.off('changedMetadate', this.#changedMetadateEvent);
      this.#current.off('changedSpec', this.#changedSpecEvent);
      this.#current.off('changedStatus', this.#changedStatusEvent);
      this.#current.off('deleted', this.#deletedEvent);
    }

    if (next) {
      next.on('updated', this.#updatedEvent);
      next.on('changed', this.#changedEvent);
      next.on('changedMetadate', this.#changedMetadateEvent);
      next.on('changedSpec', this.#changedSpecEvent);
      next.on('changedStatus', this.#changedStatusEvent);
      next.on('deleted', this.#deletedEvent);
    }
    this.#current = next;
    this.emit('replaced', {
      previous,
      next,
    });
    this.emit('changedStatus', {
      previous: previous && 'status' in previous ? (previous.status as ExpectedAny) : undefined,
      next: next && 'status' in next ? (next.status as ExpectedAny) : undefined,
    });
    this.emit('changedMetadate', {
      previous: previous && 'metadata' in previous ? (previous.metadata as ExpectedAny) : undefined,
      next: next && 'metadata' in next ? (next.metadata as ExpectedAny) : undefined,
    });
    this.emit('changedSpec', {
      previous: previous && 'spec' in previous ? (previous.spec as ExpectedAny) : undefined,
      next: next && 'spec' in next ? (next.spec as ExpectedAny) : undefined,
    });
    this.emit('changed');
    this.emit('updated');
  }
}

export { ResourceReference };
