const statsReportToObject = (results: ReadonlyMap<string, { type: string }>) => {
  return [...results.keys()].reduce((accumulator, key: string) => {
    const item = results.get(key);

    return item === undefined ? accumulator : { ...accumulator, [item.type]: item };
  }, {});
};

export default statsReportToObject;
