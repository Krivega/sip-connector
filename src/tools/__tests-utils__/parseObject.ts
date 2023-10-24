const parseObject = <T = unknown>(object: T): T => {
  return JSON.parse(JSON.stringify(object)) as T;
};

const removeUri = <T extends { uri?: string | undefined }>({
  uri,
  ...object
}: T & { uri?: string }): Omit<T & { uri?: string | undefined }, 'uri'> => {
  return object;
};

export const parseObjectWithoutUri = <T extends object>(argument: T) => {
  const parsedObject = parseObject(argument);
  const objectWithoutUri = removeUri(parsedObject);

  return objectWithoutUri;
};

export default parseObject;
