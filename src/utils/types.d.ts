declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type ExpectedAny = any;
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noopAsync = async () => {};

export { noop, noopAsync };
