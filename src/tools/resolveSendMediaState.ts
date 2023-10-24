import type SipConnector from '../SipConnector';
import log from '../logger';

const resolveSendMediaState = (sipConnector: SipConnector) => {
  const sendMediaState = async ({
    isEnabledCam,
    isEnabledMic,
  }: {
    isEnabledCam: boolean;
    isEnabledMic: boolean;
  }): Promise<void> => {
    if (!sipConnector.isCallActive) {
      return;
    }

    log('sendMediaState');

    return sipConnector.sendMediaState({ cam: isEnabledCam, mic: isEnabledMic });
  };

  return sendMediaState;
};

export default resolveSendMediaState;
