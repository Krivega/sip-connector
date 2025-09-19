const PARAMETERS_NOT_EXIST_ERROR_MESSAGE = 'Parameters are missing';

export const hasParametersNotExistError = (error: unknown): boolean => {
  return error instanceof Error && error.message === PARAMETERS_NOT_EXIST_ERROR_MESSAGE;
};

export const createParametersNotExistError = (): Error => {
  return new Error(PARAMETERS_NOT_EXIST_ERROR_MESSAGE);
};
