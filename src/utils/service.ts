import { LogService } from "../services/log/log.ts";

type Dependency<T> = new (services: Services) => T;

class Services {
  #instances: Map<Dependency<unknown>, unknown> = new Map();
  constructor() {
    console.log('Constructor', 'bar');
  }

  public get log() {
    return this.get(LogService);
  }

  get = <T>(dependency: Dependency<T>): T => {
    if (!this.#instances.has(dependency)) {
      this.#instances.set(dependency, new dependency(this));
    }
    return this.#instances.get(dependency) as T;
  }
}

export { Services };