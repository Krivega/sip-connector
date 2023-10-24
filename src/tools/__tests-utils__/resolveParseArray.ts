import parseObject from './parseObject';

const resolveParseArray = <T extends object>(parameter: keyof T) => {
  return (array: T[]) => {
    return array
      .map((item: T) => {
        return parseObject<T>(item);
      })
      .sort((previous: T, next: T) => {
        const previousValue = previous[parameter];
        const nextValue = next[parameter];

        if (typeof previousValue === 'string' && typeof nextValue === 'string') {
          return previousValue.localeCompare(nextValue);
        }

        if (previousValue > nextValue) {
          return 1;
        }

        if (previousValue < nextValue) {
          return -1;
        }

        return 0;
      });
  };
};

export default resolveParseArray;
