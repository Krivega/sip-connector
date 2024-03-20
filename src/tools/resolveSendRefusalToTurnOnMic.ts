import type SipConnector from '../SipConnector';
import log from '../logger';

const resolveSendRefusalToTurnOnMic = (sipConnector: SipConnector) => {
  const sendRefusalToTurnOnMic = async (): Promise<void> => {
    if (!sipConnector.isCallActive) {
      return;
    }

    log('sendRefusalToTurnOnMic');

    return sipConnector.sendRefusalToTurnOnMic().catch((error: unknown) => {
      log('sendRefusalToTurnOnMic: error', error);
    });
  };

  return sendRefusalToTurnOnMic;
};

export default resolveSendRefusalToTurnOnMic;
