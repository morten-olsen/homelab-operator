const isDeepSubset = (actual: ExpectedAny, expected: ExpectedAny): boolean => {
  if (typeof expected !== 'object' || expected === null) {
    return actual === expected;
  }

  if (typeof actual !== 'object' || actual === null) {
    return false;
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      return false;
    }
    return expected.every((expectedItem) => actual.some((actualItem) => isDeepSubset(actualItem, expectedItem)));
  }

  // Iterate over the keys of the expected object
  for (const key in expected) {
    if (Object.prototype.hasOwnProperty.call(expected, key)) {
      if (!Object.prototype.hasOwnProperty.call(actual, key)) {
        return false;
      }

      if (!isDeepSubset(actual[key], expected[key])) {
        return false;
      }
    }
  }

  return true;
};

export { isDeepSubset };
