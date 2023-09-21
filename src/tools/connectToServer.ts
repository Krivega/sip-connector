import { isCanceledError } from '@krivega/cancelable-promise';
import type SipConnector from '../SipConnector';
import log from '../logger';

const resolveConnectToServer = (sipConnector: SipConnector) => {
  const handleError = (error: Error): boolean => {
    if (!isCanceledError(error)) {
      throw error;
    }

    return false;
  };

  const connectToServer = (params: {
    userAgent: string;
    sipWebSocketServerURL: string;
    sipServerUrl: string;
    remoteAddress?: string;
    displayName?: string;
    name?: string;
    password?: string;
    isRegisteredUser?: boolean;
    isDisconnectOnFail?: boolean;
    sdpSemantics: 'unified-plan' | 'plan-b';
  }): Promise<boolean> => {
    const {
      userAgent,
      sipWebSocketServerURL,
      sipServerUrl,
      remoteAddress,
      displayName,
      name,
      password,
      isRegisteredUser,
      sdpSemantics,
      isDisconnectOnFail,
    } = params;

    log('connectToServer', params);

    return sipConnector
      .connect({
        userAgent,
        sdpSemantics,
        sipWebSocketServerURL,
        sipServerUrl,
        remoteAddress,
        displayName,
        password,
        user: name,
        register: isRegisteredUser,
      })
      .then(() => {
        log('connectToServer then');

        return true;
      })
      .catch((error) => {
        log('connectToServer catch: error', error);

        if (isDisconnectOnFail) {
          return sipConnector
            .disconnect()
            .then(() => {
              return handleError(error);
            })
            .catch(() => {
              return handleError(error);
            });
        }

        return handleError(error);
      });
  };

  return connectToServer;
};

export default resolveConnectToServer;
