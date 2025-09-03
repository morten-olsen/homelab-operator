import { EventEmitter } from 'eventemitter3';

import type { ResourceClass } from '../resources.ts';

import type { ResourceEvents } from './resource.ts';

class ResourceReference<T extends ResourceClass<ExpectedAny>> extends EventEmitter<ResourceEvents> {
  #current?: InstanceType<T>;

  constructor(current?: InstanceType<T>) {
    super();
    this.#current = current;
  }

  public get current() {
    return this.#current;
  }

  public set current(value: InstanceType<T> | undefined) {
    const previous = this.#current;
    if (this.#current) {
      this.#current.off('changed', this.#handleChange);
    }
    if (value) {
      value.on('changed', this.#handleChange);
    }
    this.#current = value;
    if (previous !== value) {
      this.emit('changed');
    }
  }

  #handleChange = () => {
    this.emit('changed');
  };
}

export { ResourceReference };
