import { isPromiseIsNotActualError } from 'stack-promises';

const hasPromiseIsNotActualError = (error: unknown) => {
  return error instanceof Error && isPromiseIsNotActualError(error);
};

export default hasPromiseIsNotActualError;
