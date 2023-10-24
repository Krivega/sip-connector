import type { TCustomError } from '../../types';
import getLinkError from './getLinkError';

export type TValues = {
  message?: string;
  link?: string;
  code?: string;
  cause?: string;
};

const getValuesFromError = (error: TCustomError = new Error()): TValues => {
  const { code, cause, message } = error;
  const link = getLinkError(error);
  const values: TValues = {};

  if (message) {
    values.message = message;
  }

  if (link) {
    values.link = link;
  }

  if (code) {
    values.code = code;
  }

  if (cause) {
    values.cause = cause as string;
  }

  return values;
};

export default getValuesFromError;
