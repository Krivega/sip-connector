const now = (): number => {
  return 'performance' in window ? performance.now() : Date.now();
};

export default now;
