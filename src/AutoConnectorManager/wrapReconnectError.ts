const FAILED_TO_RECONNECT = 'Failed to reconnect';

export const wrapReconnectError = (error: unknown): Error => {
  return error instanceof Error ? error : new Error(FAILED_TO_RECONNECT);
};
