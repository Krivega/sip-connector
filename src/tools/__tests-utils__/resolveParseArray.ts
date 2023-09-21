import flow from 'lodash/flow';
import property from 'lodash/property';
import sortBy from 'lodash/sortBy';
import parseObject from './parseObject';

const resolveParseArray = <T extends object>(parameter: string) => {
  const parseArray = flow(parseObject<T>, (array: T[]) => {
    return sortBy(array, property(parameter));
  }) as (array: object[]) => object[];

  return parseArray;
};

export default resolveParseArray;
