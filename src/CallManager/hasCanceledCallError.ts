/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
import { isCanceledError } from '@krivega/cancelable-promise';
import { ECallCause } from './causes';
import { Originator } from './eventNames';
import type { TCustomError } from './types';

const hasCustomError = (error: unknown): error is TCustomError => {
  return error instanceof Object && ('originator' in error || 'cause' in error);
};

const hasCanceledCallError = (error: unknown): boolean => {
  if (isCanceledError(error)) {
    return true;
  }

  if (!hasCustomError(error)) {
    return false;
  }

  const { originator, cause } = error;

  if (typeof cause === 'string') {
    return (
      cause === ECallCause.REQUEST_TIMEOUT ||
      cause === ECallCause.REJECTED ||
      (originator === Originator.LOCAL &&
        (cause === ECallCause.CANCELED || cause === ECallCause.BYE))
    );
  }

  return false;
};

export default hasCanceledCallError;
