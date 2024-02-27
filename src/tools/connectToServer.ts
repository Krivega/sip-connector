import { isCanceledError } from '@krivega/cancelable-promise';
import type { UA } from '@krivega/jssip';
import type SipConnector from '../SipConnector';
import log from '../logger';

const handleError = (error: Error): { isSuccessful: boolean } => {
  if (!isCanceledError(error)) {
    throw error;
  }

  return { isSuccessful: false };
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
  }): Promise<{ ua?: UA; isSuccessful: boolean }> => {
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
      .then((ua) => {
        log('connectToServer then');

        return { ua, isSuccessful: true };
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
