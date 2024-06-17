const DECLINE_ERROR_MESSAGE = 'Error decline with 603';
const HANDSHAKE_WEBSOCKET_OPENING_ERROR_CODE = 1006;

export const hasHandshakeWebsocketOpeningError = (error: unknown): boolean => {
  const isObject = typeof error === 'object' && error !== null;
  const isErrorWithCodeProperty = isObject && 'code' in error;

  return isErrorWithCodeProperty && error.code === HANDSHAKE_WEBSOCKET_OPENING_ERROR_CODE;
};

export const hasDeclineResponseFromServer = (error: Error): boolean => {
  return error.message === DECLINE_ERROR_MESSAGE;
};
