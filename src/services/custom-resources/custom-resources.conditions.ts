import { EventEmitter } from 'eventemitter3';
import equal from 'deep-equal';

import type { CustomResource } from './custom-resources.custom-resource.ts';
import type { CustomResourceStatus } from './custom-resources.types.ts';

type CustomResourceStatusOptions = {
  resource: CustomResource<ExpectedAny>;
};

type CustomResourceConditionsEvents = {
  changed: (type: string, condition: Condition) => void;
};

type Condition = {
  lastTransitionTime: Date;
  status: 'True' | 'False' | 'Unknown';
  syncing?: boolean;
  failed?: boolean;
  resource?: boolean;
  reason?: string;
  message?: string;
  observedGeneration?: number;
};

class CustomResourceConditions extends EventEmitter<CustomResourceConditionsEvents> {
  #options: CustomResourceStatusOptions;
  #conditions: Record<string, Condition>;
  #changed: boolean;

  constructor(options: CustomResourceStatusOptions) {
    super();
    this.#options = options;
    this.#conditions = Object.fromEntries(
      (options.resource.status?.conditions || []).map(({ type, lastTransitionTime, ...condition }) => [
        type,
        {
          ...condition,
          lastTransitionTime: new Date(lastTransitionTime),
        },
      ]),
    );
    options.resource.on('changed', this.#handleChange);
    this.#changed = false;
  }

  #handleChange = () => {
    const { resource } = this.#options;
    for (const { type, ...condition } of resource.status?.conditions || []) {
      const next = {
        ...condition,
        lastTransitionTime: new Date(condition.lastTransitionTime),
      };
      const current = this.#conditions[type];
      const isEqual = equal(current, next);
      const isNewer = !current || next.lastTransitionTime > current.lastTransitionTime;
      if (isEqual || !isNewer) {
        return;
      }
      this.#conditions[type] = next;
      this.emit('changed', type, next);
    }
  };

  public get = (type: string): Condition | undefined => {
    return this.#conditions[type];
  };

  public set = async (type: string, condition: Omit<Condition, 'lastTransitionTime'>) => {
    const current = this.#conditions[type];
    const isEqual = equal(
      { ...current, lastTransitionTime: undefined },
      { ...condition, lastTransitionTime: undefined },
    );
    if (isEqual) {
      return;
    }
    this.#changed = true;
    this.#conditions[type] = {
      ...condition,
      lastTransitionTime: current && current.status === condition.status ? current.lastTransitionTime : new Date(),
      observedGeneration: this.#options.resource.metadata?.generation,
    };
    await this.save();
  };

  public save = async () => {
    if (!this.#changed) {
      return;
    }
    try {
      this.#changed = false;
      const { resource } = this.#options;
      const status: CustomResourceStatus = {
        conditions: Object.entries(this.#conditions).map(([type, condition]) => ({
          ...condition,
          type,
          lastTransitionTime: condition.lastTransitionTime.toISOString(),
        })),
      };
      await resource.patchStatus(status);
    } catch (error) {
      this.#changed = true;
      throw error;
    }
  };
}

export { CustomResourceConditions };
