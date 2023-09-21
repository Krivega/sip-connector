import type SipConnector from '../SipConnector';
import log from '../logger';

const resolveSendRefusalToTurnOnMic = (sipConnector: SipConnector) => {
  const sendRefusalToTurnOnMic = (): Promise<void> => {
    if (!sipConnector.isCallActive) {
      return Promise.resolve();
    }

    log('sendRefusalToTurnOnMic');

    return sipConnector.sendRefusalToTurnOnMic().catch((error) => {
      log('sendRefusalToTurnOnMic: error', error);
    });
  };

  return sendRefusalToTurnOnMic;
};

export default resolveSendRefusalToTurnOnMic;
