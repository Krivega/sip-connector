import logger from '../../logger';

const stringifyMessage = (message: unknown) => {
  let stringifiedMessage = '';

  try {
    stringifiedMessage = JSON.stringify(message);
  } catch (stringifyError: unknown) {
    logger('failed to stringify message', stringifyError);
  }

  return stringifiedMessage;
};

export default stringifyMessage;
