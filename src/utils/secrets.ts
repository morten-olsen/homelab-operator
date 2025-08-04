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

export { decodeSecret };
