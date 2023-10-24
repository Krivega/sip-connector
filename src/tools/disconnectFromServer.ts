import type SipConnector from '../SipConnector';
import log from '../logger';

const resolveDisconnectFromServer = (sipConnector: SipConnector) => {
  return async () => {
    log('disconnectFromServer');

    return sipConnector
      .disconnect()
      .then(() => {
        log('disconnectFromServer: then');

        return false;
      })
      .catch((error) => {
        log('disconnectFromServer: catch', error);

        return false;
      });
  };
};

export default resolveDisconnectFromServer;
