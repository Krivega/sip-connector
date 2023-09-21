import debug from 'debug';

const NAME = 'sip-connector';

const logger = debug(NAME);

export default logger;

export { default as debug } from 'debug';

export const enableDebug = () => {
  debug.enable(`${NAME}`);
};

export const disableDebug = () => {
  debug.enable(`-${NAME}`);
};
