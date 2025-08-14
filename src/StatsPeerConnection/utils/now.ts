const now = (): number => {
  if ('performance' in window) {
    return performance.now();
  }

  return Date.now();
};

export default now;
