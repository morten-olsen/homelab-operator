class NotReadyError extends Error {
  #reason?: string;

  constructor(reason?: string, message?: string) {
    super(message || reason || 'Resource is not ready');
    this.#reason = reason;
  }

  get reason() {
    return this.#reason;
  }
}

export { NotReadyError };
