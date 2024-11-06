import setParametersToSender from '../setParametersToSender';
import type { TRtpSendParameters } from '../types';

const resolveUpdateSenderInTransceiver = (parametersTarget: TRtpSendParameters) => {
  return async (transceiver: RTCRtpTransceiver) => {
    if (Object.keys(parametersTarget).length > 0) {
      await setParametersToSender(transceiver.sender, parametersTarget);
    }
  };
};

export default resolveUpdateSenderInTransceiver;
