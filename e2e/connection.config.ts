export type TConnectionFormConfig = {
  serverAddress: string;
  displayName: string;
  conferenceNumber: string;
  userNumber: string;
  password: string;
};

/**
 * Данные формы демо для сценария «только подключение» (connectButton).
 * Нужны валидные креды на целевом сервере.
 */
export const connectionFormConfig: TConnectionFormConfig = {
  serverAddress: 'dev.vinteo.com',
  displayName: 'test sip-connector',
  /** Обязателен для валидности HTML-формы; для connect не уходит в SIP, но поле required */
  conferenceNumber: '1008',
  userNumber: '777',
  password: '5V1tCz',
};
