import setEncodingsToSender from './setEncodingsToSender';
import findSenderByStream from './findSenderByStream';

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
