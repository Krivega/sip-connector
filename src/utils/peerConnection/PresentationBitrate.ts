import { setEncodingsToSender } from '@/tools/setParametersToSender';

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

  const sender = connection.getSenders().find((itemSender) => {
    return itemSender.track === videoTrack;
  });

  if (sender) {
    await setEncodingsToSender(sender, { maxBitrate });
  }
};
