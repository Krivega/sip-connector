import debug from 'debug';

const NAME = 'sip-connector';

const logger = debug(NAME);

export const logError = (scope: string, error: unknown) => {
  logger(`${scope}:`, error);
};

export const enableDebug = () => {
  debug.enable(NAME);
};

export const disableDebug = () => {
  debug.enable(`-${NAME}`);
};

export default logger;
