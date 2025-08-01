const getWithNamespace = (input: string) => {
  const result = input.split('/');
  const first = result.pop();
  if (!first) {
    throw new Error(`${input} could not be parsed as a namespace`);
  }
  return {
    name: first,
    namespace: result.join('/'),
  };
};

export { getWithNamespace };
