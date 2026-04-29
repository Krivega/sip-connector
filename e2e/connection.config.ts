export type TConnectionFormConfig = {
  serverAddress: string;
  displayName: string;
  conferenceNumber: string;
  userNumber: string;
  password: string;
};

export const connectionFormConfig: TConnectionFormConfig = {
  serverAddress: 'dev.vinteo.com',
  displayName: 'test sip-connector',
  conferenceNumber: '1000',
  userNumber: '777',
  password: '5V1tCz',
};

export const connectionFormConfigSpectator: TConnectionFormConfig = {
  ...connectionFormConfig,
  displayName: 'test sip-connector spectator',
  conferenceNumber: '1008',
};
