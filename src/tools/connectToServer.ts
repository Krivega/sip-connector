import { isCanceledError } from '@krivega/cancelable-promise';
import type { UA } from '@krivega/jssip';
import { hasCanceledError } from 'repeated-calls';
import type SipConnector from '../SipConnector';
import log from '../logger';

const handleError = (error: Error): { isSuccessful: boolean } => {
  if (!isCanceledError(error) && !hasCanceledError(error)) {
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
      isDisconnectOnFail,
    } = parameters;

    log('connectToServer', parameters);

    return sipConnector
      .connect({
        userAgent,
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
      .catch(async (error: unknown) => {
        log('connectToServer catch: error', error);

        if (isDisconnectOnFail === true) {
          return sipConnector
            .disconnect()
            .then(() => {
              return handleError(error as Error);
            })
            .catch(() => {
              return handleError(error as Error);
            });
        }

        return handleError(error as Error);
      });
  };

  return connectToServer;
};

export default resolveConnectToServer;
