type CoalescingQueuedOptions<T> = {
  action: () => Promise<T>;
};

const createResolvable = <T>() => {
  let resolve: (item: T) => void = () => {};
  let reject: (item: T) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { resolve, reject, promise };
};

type Resolveable<T> = ReturnType<typeof createResolvable<T>>;

class CoalescingQueued<T> {
  #options: CoalescingQueuedOptions<T>;
  #next?: Resolveable<T>;
  #current?: Promise<T>;

  constructor(options: CoalescingQueuedOptions<T>) {
    this.#options = options;
  }

  #start = () => {
    if (this.#current) {
      return;
    }
    const next = this.#next;
    if (next) {
      const action = this.#options.action();
      this.#current = action;
      this.#next = undefined;
      action.then(next.resolve);
      action.catch(next.reject);
      action.finally(() => {
        this.#current = undefined;
        this.#start();
      });
    }
  };

  public run = async () => {
    if (!this.#next) {
      this.#next = createResolvable<T>();
    }
    const next = this.#next;
    this.#start();
    return next.promise;
  };
}

export { CoalescingQueued };
