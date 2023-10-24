import type SipConnector from '../SipConnector';
import log from '../logger';

const resolveSendRefusalToTurnOnCam = (sipConnector: SipConnector) => {
  const sendRefusalToTurnOnCam = async (): Promise<void> => {
    if (!sipConnector.isCallActive) {
      return;
    }

    log('sendRefusalToTurnOnCam');

    return sipConnector.sendRefusalToTurnOnCam().catch((error) => {
      log('sendRefusalToTurnOnCam: error', error);
    });
  };

  return sendRefusalToTurnOnCam;
};

export default resolveSendRefusalToTurnOnCam;
