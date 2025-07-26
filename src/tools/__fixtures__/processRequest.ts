/* eslint-disable @typescript-eslint/max-params */
import type { SipConnector } from '../../SipConnector';
import { SipConnectorFacade } from '../../SipConnectorFacade';
import { canConnectToServer } from './permissions';

/**
 * initUa
 *
 * @param {object}   sipConnector                               - The sipConnector
 * @param {Function} resolve                             - The resolve
 * @param {Function} reject                              - The reject
 * @param {object}   params                              - Params for execution
 * @param {Function} params.fetchIpSipServer             - The fetch sip url
 * @param {string}   params.sipWebSocketServerURL        - The sip web socket server url
 * @param {string}   params.sipServerUrl                 - The sip server url
 * @param {string}   params.displayName                  - The display name
 * @param {string}   params.name                         - The name
 * @param {string}   params.password                     - The password
 * @param {boolean}  params.isRegisteredUser             - Indicates if register user
 * @param {boolean}  params.isRegisteredUserChanged      - Indicates if register user changed
 * @param {boolean}  params.displayNameChanged           - The display name changed
 * @param {boolean}  params.nameChanged                  - The name changed
 * @param {boolean}  params.passwordChanged              - The password changed
 * @param {boolean}  params.sipWebSocketServerURLChanged - The sip web socket server url changed
 *
 * @returns {Promise} initUa resolved success true|false
 */
const initUa = (
  sipConnector: SipConnector,
  resolve: (success: boolean) => void,
  reject: () => void,
  {
    sipServerUrl,
    sipWebSocketServerURL,
    remoteAddress,
    displayName,
    name,
    password,
    isRegisteredUser,
  }: {
    remoteAddress: string | undefined;
    sipServerUrl: string;
    displayName: string | undefined;
    sipWebSocketServerURL: string;
    name: string;
    password: string;
    isRegisteredUser: boolean;
  },
) => {
  const sipConnectorFacade = new SipConnectorFacade(sipConnector);

  Promise.resolve()
    .then(async () => {
      if (
        canConnectToServer({
          sipServerUrl,
          remoteAddress,
          sipWebSocketServerURL,
          isRegisteredUser,
          name,
          password,
        })
      ) {
        return sipConnectorFacade.connectToServer({
          remoteAddress,
          sipServerUrl,
          sipWebSocketServerURL,
          displayName,
          name,
          password,
          isRegisteredUser,
          userAgent: 'Chrome',
        });
      }

      return sipConnectorFacade.disconnectFromServer().then(() => {
        return { isSuccessful: false };
      });
    })
    .then(({ isSuccessful }) => {
      resolve(!!isSuccessful);
    })
    .catch(reject);
};

const resolveInitUaPromised = (sipConnector: SipConnector) => {
  return async (state: {
    remoteAddress: string | undefined;
    sipServerUrl: string;
    displayName: string | undefined;
    sipWebSocketServerURL: string;
    name: string;
    password: string;
    isRegisteredUser: boolean;
  }) => {
    return new Promise<boolean>((resolve, reject) => {
      initUa(sipConnector, resolve, reject, state);
    });
  };
};

export default resolveInitUaPromised;
