import findSenderByStream from '../utils/findSenderByStream';
import setEncodingsToSender from './setEncodingsToSender';

const scaleMaxBitrateBySender = (
  senders: RTCRtpSender[],
  mediaStream: MediaStream,
  maxBitrate: number
) => {
  const sender = findSenderByStream(senders, mediaStream);

  if (sender) {
    return setEncodingsToSender(sender, { maxBitrate });
  }

  return Promise.resolve();
};

export default scaleMaxBitrateBySender;
