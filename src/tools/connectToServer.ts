import { isCanceledError } from '@krivega/cancelable-promise';
import type SipConnector from '../SipConnector';
import log from '../logger';

const handleError = (error: Error): boolean => {
  if (!isCanceledError(error)) {
    throw error;
  }

  return false;
};

const resolveConnectToServer = (sipConnector: SipConnector) => {
  const connectToServer = async (parameters: {
    userAgent: string;
    sipWebSocketServerURL: string;
    sipServerUrl: string;
    remoteAddress?: string;
    displayName?: string;
    name?: string;
    password?: string;
    isRegisteredUser?: boolean;
    isDisconnectOnFail?: boolean;
    sdpSemantics: 'plan-b' | 'unified-plan';
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
    } = parameters;

    log('connectToServer', parameters);

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
      .catch(async (error: Error) => {
        log('connectToServer catch: error', error);

        if (isDisconnectOnFail === true) {
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
