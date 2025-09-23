const NOT_READY_FOR_CONNECTION_ERROR_MESSAGE = 'Not ready for connection';

export const hasNotReadyForConnectionError = (error: unknown): boolean => {
  return error instanceof Error && error.message === NOT_READY_FOR_CONNECTION_ERROR_MESSAGE;
};

export const createNotReadyForConnectionError = (): Error => {
  return new Error(NOT_READY_FOR_CONNECTION_ERROR_MESSAGE);
};
