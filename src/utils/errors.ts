const DECLINE_RESPONSE_CODE = '603';

export const hasDeclineResponseFromServer = (error: Error): boolean => {
  return error.message.includes(DECLINE_RESPONSE_CODE);
};
