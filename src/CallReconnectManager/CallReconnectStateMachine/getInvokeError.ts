export const getInvokeError = (event: unknown): unknown => {
  if (event !== null && typeof event === 'object' && 'error' in event) {
    return (event as { error: unknown }).error;
  }

  return undefined;
};
