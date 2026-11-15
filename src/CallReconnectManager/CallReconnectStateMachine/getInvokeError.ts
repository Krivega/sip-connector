export const getInvokeError = (event: unknown): unknown => {
  return event !== null && typeof event === 'object' && 'error' in event
    ? (event as { error: unknown }).error
    : undefined;
};
