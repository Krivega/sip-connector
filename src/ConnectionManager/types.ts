export type TOptionsExtraHeaders = {
  extraHeaders?: string[];
};

export type TIceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

export type TServerConfiguration = {
  sipServerUrl: string;
  sipServerIp: string;
  remoteAddress: string;
  iceServers: TIceServer[];
};

export type TParametersConnection = TServerConfiguration &
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

export type TConnectionConfiguration = TServerConfiguration & {
  displayName: string;
  authorizationUser: string;
  register?: boolean;
  user?: string;
  password?: string;
};
