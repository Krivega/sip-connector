import debug from 'debug';

const NAME = 'demo';

const logger = debug(NAME);

export const enableDebug = () => {
  debug.enable(`${NAME}:*`);
};

export const disableDebug = () => {
  debug.enable(`-${NAME}`);
};

const resolveDebug = (name: string) => {
  return logger.extend(name);
};

export default resolveDebug;
