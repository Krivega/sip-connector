export type TOptionsExtraHeaders = {
  extraHeaders?: string[];
};

export type TIceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

export type TServerConfig = {
  sipServerUrl: string;
  sipServerIp: string;
  remoteAddress: string;
  iceServers: TIceServer[];
};

export type TParametersConnection = TServerConfig &
  TOptionsExtraHeaders & {
    displayName: string;
    register?: boolean;
    user?: string;
    password?: string;
    userAgent?: string;
    sessionTimers?: boolean;
    registerExpires?: number;
    connectionRecoveryMinInterval?: number;
    connectionRecoveryMaxInterval?: number;
  };

export type TConnectionConfig = TServerConfig & {
  displayName: string;
  authorizationUser: string;
  register?: boolean;
  user?: string;
  password?: string;
};
