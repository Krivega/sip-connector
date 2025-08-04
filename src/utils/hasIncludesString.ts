const hasIncludesString = (source?: string, target?: string): boolean => {
  return (
    source !== undefined &&
    target !== undefined &&
    source.toLowerCase().includes(target.toLowerCase())
  );
};

export default hasIncludesString;
