import { flowRight } from 'lodash';

const parseObject = <T = unknown>(object: T): T => {
  return JSON.parse(JSON.stringify(object)) as T;
};

const removeUri = <T extends { uri?: string | undefined }>({
  uri,
  ...object
}: T & { uri?: string }): Omit<T & { uri?: string | undefined }, 'uri'> => {
  return object;
};

export const parseObjectWithoutUri = flowRight(removeUri, parseObject) as (
  ...arguments_: object[]
) => object;

export default parseObject;
