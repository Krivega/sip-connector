import findSenderByStream from '@/utils/findSenderByStream';
import setEncodingsToSender from './setEncodingsToSender';

// unused (see comment in src/PresentationManager/@PresentationManager.ts)
const setMaxBitrateToSender = async (
  senders: RTCRtpSender[],
  mediaStream: MediaStream,
  maxBitrate: number,
) => {
  const sender = findSenderByStream(senders, mediaStream);

  if (sender) {
    return setEncodingsToSender(sender, { maxBitrate });
  }

  return undefined;
};

export default setMaxBitrateToSender;
