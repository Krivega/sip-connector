const NOT_READY_FOR_CONNECTION_ERROR_MESSAGE = 'Not ready for connection';

type TNotReadyForConnectionError = Error;

export const hasNotReadyForConnectionError = (
  error: unknown,
): error is TNotReadyForConnectionError => {
  return error instanceof Error && error.message === NOT_READY_FOR_CONNECTION_ERROR_MESSAGE;
};

export const createNotReadyForConnectionError = (): TNotReadyForConnectionError => {
  return new Error(NOT_READY_FOR_CONNECTION_ERROR_MESSAGE) as TNotReadyForConnectionError;
};
