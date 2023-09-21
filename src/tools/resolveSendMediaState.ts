import type SipConnector from '../SipConnector';
import log from '../logger';

const resolveSendMediaState = (sipConnector: SipConnector) => {
  const sendMediaState = ({ isEnabledCam, isEnabledMic }): Promise<void> => {
    if (!sipConnector.isCallActive) {
      return Promise.resolve();
    }

    log('sendMediaState');

    return sipConnector.sendMediaState({ cam: isEnabledCam, mic: isEnabledMic });
  };

  return sendMediaState;
};

export default resolveSendMediaState;
