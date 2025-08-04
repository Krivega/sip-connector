import type { TCustomError } from '@/CallManager';
import getLinkError from './getLinkError';
import stringifyMessage from './stringifyMessage';

export type TValues = {
  code: string;
  cause: string;
  message: string;
  link?: string;
};

const unknownError = new Error('Unknown error');

const getValuesFromError = (error: TCustomError = unknownError): TValues => {
  const { code, cause, message } = error;
  const link = getLinkError(error);
  const values: TValues = { code: '', cause: '', message: '' };

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (typeof message === 'object' && message !== null) {
    values.message = stringifyMessage(message);
  } else if (message) {
    values.message = String(message);
  }

  if (link !== undefined && link !== '') {
    values.link = link;
  }

  if (code !== undefined && code !== '') {
    values.code = code;
  }

  if (cause !== undefined && cause !== '') {
    values.cause = cause as string;
  }

  return values;
};

export default getValuesFromError;
