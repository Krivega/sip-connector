const DECLINED_RESPONSE = '603';

export const hasDeclineResponseFromServer = (error: Error): boolean => {
  return error.message.includes(DECLINED_RESPONSE) || error.name.includes(DECLINED_RESPONSE);
};
