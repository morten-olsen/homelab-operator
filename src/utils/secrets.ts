const decodeSecret = <T extends Record<string, string>>(
  data: Record<string, ExpectedAny> | undefined,
): T | undefined => {
  if (!data) {
    return undefined;
  }
  return Object.fromEntries(
    Object.entries(data).map(([name, value]) => [name, Buffer.from(value, 'base64').toString('utf8')]),
  ) as T;
};

const encodeSecret = <T extends Record<string, string>>(data: T | undefined): Record<string, string> | undefined => {
  if (!data) {
    return undefined;
  }
  return Object.fromEntries(
    Object.entries(data).map(([name, value]) => [name, Buffer.from(value, 'utf8').toString('base64')]),
  );
};
export { decodeSecret, encodeSecret };
