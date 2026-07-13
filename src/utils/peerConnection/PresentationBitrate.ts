import { setEncodingsToSender } from '@/tools/setParametersToSender';
import findSenderByTrack from './findSenderByTrack';

export const setPresentationMaxBitrate = async ({
  connection,
  videoTrack,
  maxBitrate,
}: {
  connection: RTCPeerConnection | undefined;
  videoTrack: MediaStreamVideoTrack | undefined;
  maxBitrate: number | undefined;
}): Promise<void> => {
  if (!connection || !videoTrack || maxBitrate === undefined) {
    return;
  }

  const sender = findSenderByTrack(connection, videoTrack);

  if (sender) {
    await setEncodingsToSender(sender, { maxBitrate });
  }
};
