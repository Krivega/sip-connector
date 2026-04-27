const TERMINAL_REGISTRATION_STATUS_CODES = new Set([401, 403]);

type TRegistrationErrorLike = {
  response?: {
    status_code?: unknown;
  };
};

const isRegistrationErrorLike = (error: unknown): error is TRegistrationErrorLike => {
  return typeof error === 'object' && error !== null && 'response' in error;
};

const hasTerminalRegistrationStatus = (error: unknown): boolean => {
  if (!isRegistrationErrorLike(error)) {
    return false;
  }

  const statusCode = error.response?.status_code;

  return typeof statusCode === 'number' && TERMINAL_REGISTRATION_STATUS_CODES.has(statusCode);
};

export const baseCanRetryOnError = (error: unknown): boolean => {
  return !hasTerminalRegistrationStatus(error);
};
