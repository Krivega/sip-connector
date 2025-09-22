import { isPromiseIsNotActualError } from 'stack-promises';

const hasConnectionPromiseIsNotActualError = (error: unknown) => {
  return error instanceof Error && isPromiseIsNotActualError(error);
};

export default hasConnectionPromiseIsNotActualError;
