import findSenderByStream from '../utils/findSenderByStream';
import setEncodingsToSender from './setEncodingsToSender';

const scaleMaxBitrateBySender = async (
  senders: RTCRtpSender[],
  mediaStream: MediaStream,
  maxBitrate: number,
) => {
  const sender = findSenderByStream(senders, mediaStream);

  if (sender) {
    return setEncodingsToSender(sender, { maxBitrate });
  }

  // eslint-disable-next-line unicorn/no-useless-undefined
  return undefined;
};

export default scaleMaxBitrateBySender;
