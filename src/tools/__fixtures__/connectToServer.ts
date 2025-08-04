import {
  SIP_SERVER_URL,
  SIP_WEB_SOCKET_SERVER_URL,
  uaConfigurationWithAuthorization as _uaConfigurationWithAuthorization,
  displayName,
  user,
} from '@/__fixtures__';
import { NAME_INCORRECT, PASSWORD_CORRECT, PASSWORD_CORRECT_2 } from '@/__fixtures__/jssip.mock';
import { URI } from '@krivega/jssip';

const baseDataForConnection = {
  remoteAddress: '10.10.10.10',
  sipServerUrl: SIP_SERVER_URL,
  sipWebSocketServerURL: SIP_WEB_SOCKET_SERVER_URL,
  userAgent: 'Chrome',
};

export const LOCKED_SIP_WEB_SOCKET_SERVER_URL = 'LOCKED_SIP_WEB_SOCKET_SERVER_URL';

export const dataForConnectionWithAuthorization = {
  ...baseDataForConnection,
  password: PASSWORD_CORRECT,
  name: user,
  isRegisteredUser: true,
};
export const dataForConnectionWithAuthorizationWithDisplayName = {
  ...baseDataForConnection,
  displayName,
};
export const dataForConnectionWithoutAuthorization = {
  ...baseDataForConnection,
  displayName,
  isRegisteredUser: false,
};
export const dataForConnectionWithoutAuthorizationWithoutDisplayName = {
  ...dataForConnectionWithoutAuthorization,
  displayName: '',
};
export const dataForConnectionWithoutAuthorizationWithSipServerUrlChanged = {
  ...dataForConnectionWithoutAuthorization,
  sipServerUrl: `${dataForConnectionWithoutAuthorization.sipServerUrl}Changed`,
};
export const dataForConnectionWithoutAuthorizationWithSipWebSocketServerUrlChanged = {
  ...dataForConnectionWithoutAuthorization,
  sipWebSocketServerURL: `${dataForConnectionWithoutAuthorization.sipWebSocketServerURL}Changed`,
  sipWebSocketServerURLChanged: true,
};
export const dataForConnectionWithAuthorizationIncorrectUser = {
  ...dataForConnectionWithAuthorization,
  name: NAME_INCORRECT,
};
export const dataForConnectionWithAuthorizationIncorrectPassword = {
  ...dataForConnectionWithAuthorization,
  password: 'incorrect',
};
export const withNameChanged = {
  ...dataForConnectionWithAuthorization,
  nameChanged: true,
};
export const dataForConnectionWithAuthorizationPasswordChanged = {
  ...dataForConnectionWithAuthorization,
  password: PASSWORD_CORRECT_2,
  passwordChanged: true,
};

export const uaConfigurationWithAuthorization = _uaConfigurationWithAuthorization;

export const uaConfigurationWithAuthorizationPasswordChanged = {
  ...uaConfigurationWithAuthorization,
  password: PASSWORD_CORRECT_2,
};

export const oneWord = 'a';
export const twoWord = 'ab';
export const thirdWord = 'abc';

export const uriWithName = (name: string, url: string = SIP_SERVER_URL) => {
  return new URI('sip', name, url);
};

export {
  uaConfigurationWithoutAuthorization,
  uaConfigurationWithoutAuthorizationWithoutDisplayName,
} from '../../__fixtures__';
