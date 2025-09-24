const resolveParameters = async <T extends object>(
  parameters: (() => Promise<T>) | T,
): Promise<T> => {
  if (typeof parameters === 'function') {
    return parameters();
  }

  return parameters;
};

export default resolveParameters;
