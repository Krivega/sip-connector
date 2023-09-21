import type SipConnector from '../SipConnector';
import log from '../logger';

const resolveSendRefusalToTurnOnCam = (sipConnector: SipConnector) => {
  const sendRefusalToTurnOnCam = (): Promise<void> => {
    if (!sipConnector.isCallActive) {
      return Promise.resolve();
    }

    log('sendRefusalToTurnOnCam');

    return sipConnector.sendRefusalToTurnOnCam().catch((error) => {
      log('sendRefusalToTurnOnCam: error', error);
    });
  };

  return sendRefusalToTurnOnCam;
};

export default resolveSendRefusalToTurnOnCam;
