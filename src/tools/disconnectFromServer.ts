import type SipConnector from '../SipConnector';
import log from '../logger';

const resolveDisconnectFromServer = (sipConnector: SipConnector) => {
  return async () => {
    log('disconnectFromServer');

    return sipConnector
      .disconnect()
      .then(() => {
        log('disconnectFromServer: then');

        return { isSuccessful: true };
      })
      .catch((error: unknown) => {
        log('disconnectFromServer: catch', error);

        return { isSuccessful: false };
      });
  };
};

export default resolveDisconnectFromServer;
