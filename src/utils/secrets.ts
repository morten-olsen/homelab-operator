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

const encodeSecret = <T extends Record<string, string | undefined>>(
  data: T | undefined,
): Record<string, string> | undefined => {
  if (!data) {
    return undefined;
  }
  return Object.fromEntries(
    Object.entries(data).map(([name, value]) => [name, Buffer.from(value || '', 'utf8').toString('base64')]),
  );
};

const generateRandomHexPass = (bytes = 32) => {
  return `pass_${Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString('hex')}`;
};

export { decodeSecret, encodeSecret, generateRandomHexPass };
