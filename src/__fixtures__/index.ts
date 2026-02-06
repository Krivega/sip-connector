import { URI } from '@krivega/jssip';

import JsSIP, { PASSWORD_CORRECT } from './jssip.mock';

export const user = 'user';
export const displayName = 'displayName';
export const SIP_SERVER_URL = 'SIP_SERVER_URL';
export const SIP_WEB_SOCKET_SERVER_URL = 'SIP_WEB_SOCKET_SERVER_URL';

const socket = new JsSIP.WebSocketInterface(`wss://${SIP_WEB_SOCKET_SERVER_URL}/webrtc/wss/`);

const baseDataForConnection = {
  displayName: 'DISPLAY_NAME',
  userAgent: 'Chrome',
  sipServerIp: SIP_SERVER_URL,
  sipServerUrl: SIP_WEB_SOCKET_SERVER_URL,
};

export const dataForConnectionWithoutAuthorizationWithoutDisplayName = {
  ...baseDataForConnection,
  displayName: 'DISPLAY_NAME',
  register: false,
};
export const dataForConnectionWithAuthorization = {
  ...baseDataForConnection,
  user,
  password: PASSWORD_CORRECT,
  register: true,
  authorizationUser: user,
};
export const dataForConnectionWithAuthorizationWithDisplayName = {
  ...dataForConnectionWithAuthorization,
  displayName,
};
export const dataForConnectionWithoutAuthorization = {
  ...baseDataForConnection,
  displayName,
  authorizationUser: user,
  register: false,
};

const baseUaConfiguration = {
  session_timers: false,
  sockets: [socket],
  user_agent: 'Chrome',
  sdpSemantics: 'unified-plan',
  register_expires: 300,
  connection_recovery_max_interval: 6,
  connection_recovery_min_interval: 2,
};
export const uaConfigurationWithAuthorization = {
  ...baseUaConfiguration,
  password: PASSWORD_CORRECT,
  uri: new URI('sip', user, SIP_SERVER_URL),
  display_name: 'DISPLAY_NAME',
  register: true,
};
export const uaConfigurationWithAuthorizationWithDisplayName = {
  ...baseUaConfiguration,
  password: PASSWORD_CORRECT,
  uri: new URI('sip', user, SIP_SERVER_URL),
  display_name: displayName,
  register: true,
};
export const uaConfigurationWithoutAuthorization = {
  ...baseUaConfiguration,
  display_name: displayName,
  register: false,
};
export const uaConfigurationWithoutAuthorizationWithoutDisplayName = {
  ...baseUaConfiguration,
  display_name: 'DISPLAY_NAME',
  register: false,
};

export const remoteAddress = '10.10.10.10';

export const extraHeadersRemoteAddress = [`X-Vinteo-Remote: ${remoteAddress}`];
