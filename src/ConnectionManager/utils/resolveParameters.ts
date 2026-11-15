const resolveParameters = async <T extends object>(
  parameters: (() => Promise<T>) | T,
): Promise<T> => {
  return typeof parameters === 'function' ? parameters() : parameters;
};

export default resolveParameters;
