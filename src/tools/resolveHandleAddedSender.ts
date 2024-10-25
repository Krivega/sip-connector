import setParametersToSender from '../setParametersToSender';
import type { TRtpSendParameters } from '../types';

const resolveHandleAddedSender = (rtpSendParameters?: TRtpSendParameters) => {
  return async (sender: RTCRtpSender, track: MediaStreamTrack) => {
    if (track.kind === 'video' && rtpSendParameters !== undefined) {
      await setParametersToSender(sender, rtpSendParameters);
    }
  };
};

export default resolveHandleAddedSender;
