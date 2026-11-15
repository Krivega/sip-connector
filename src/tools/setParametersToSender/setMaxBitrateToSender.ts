import findSenderByStream from '@/utils/peerConnection/findSenderByStream';
import setEncodingsToSender from './setEncodingsToSender';

const setMaxBitrateToSender = async (
  senders: RTCRtpSender[],
  mediaStream: MediaStream,
  maxBitrate: number,
) => {
  const sender = findSenderByStream(senders, mediaStream);

  return sender ? setEncodingsToSender(sender, { maxBitrate }) : undefined;
};

export default setMaxBitrateToSender;
