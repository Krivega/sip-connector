const DECLINE_ERROR_MESSAGE = 'Error decline with 603';

export const hasDeclineResponseFromServer = (error: Error): boolean => {
  return error.message === DECLINE_ERROR_MESSAGE;
};
