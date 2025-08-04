import PQueue from 'p-queue';
import pRetry from 'p-retry';

type QueueCreateOptions = ConstructorParameters<typeof PQueue>[0];

type QueueAddOptions = Parameters<typeof pRetry>[1] & {
  retries?: number;
};

type QueueOptions = QueueCreateOptions & {
  retries?: number;
};

class Queue {
  #options: QueueOptions;
  #queue: PQueue;

  constructor(options: QueueOptions = {}) {
    this.#options = options;
    this.#queue = new PQueue(options);
  }

  public get concurrency() {
    return this.#queue.concurrency;
  }

  public set concurrency(value: number) {
    this.#queue.concurrency = value;
  }

  public add = async <T>(task: () => Promise<T>, options: QueueAddOptions = {}) => {
    const withRetry = () =>
      pRetry(task, {
        retries: options.retries || this.#options.retries || 1,
      });
    return this.#queue.add(withRetry);
  };
}

export { Queue };
