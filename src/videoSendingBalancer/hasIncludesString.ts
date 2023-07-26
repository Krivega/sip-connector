const hasIncludesString = (source?: string, target?: string): boolean => {
  return !!source && !!target && source.toLowerCase().includes(target.toLowerCase());
};

export default hasIncludesString;
