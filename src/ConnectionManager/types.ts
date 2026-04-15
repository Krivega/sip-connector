export type TConnectionConfiguration = {
  sipServerIp: string;
  sipServerUrl: string;
  displayName: string;
  authorizationUser: string;
  register?: boolean;
  user?: string;
  password?: string;
};
