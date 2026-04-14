import resolveDebug from '@/logger';

const debug = resolveDebug('stringifyMessage');

const stringifyMessage = (message: unknown) => {
  let stringifiedMessage = '';

  try {
    stringifiedMessage = JSON.stringify(message);
  } catch (stringifyError: unknown) {
    debug('failed to stringify message', stringifyError);
  }

  return stringifiedMessage;
};

export default stringifyMessage;
