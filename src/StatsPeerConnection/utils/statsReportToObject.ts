const statsReportToObject = (results: ReadonlyMap<string, { type: string }>) => {
  return [...results.keys()].reduce((accumulator, key: string) => {
    const item = results.get(key);

    if (item === undefined) {
      return accumulator;
    }

    return { ...accumulator, [item.type]: item };
  }, {});
};

export default statsReportToObject;
