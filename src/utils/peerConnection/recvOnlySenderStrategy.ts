import { applySenderParams } from './applySenderParams';
import { setTransceiverDirection } from './transceiverDirection';

import type { TTransceiverOptions } from '@/utils/peerConnection/types';

export const addVideoTrackInSender = async (
  connection: RTCPeerConnection,
  videoTrack: MediaStreamVideoTrack,
  options: TTransceiverOptions,
): Promise<void> => {
  const { direction } = options;
  const sender = connection.addTrack(videoTrack);
  const transceiver = connection.getTransceivers().find((itemTransceiver) => {
    return itemTransceiver.sender === sender;
  });

  if (transceiver !== undefined && direction !== undefined && direction !== transceiver.direction) {
    setTransceiverDirection(transceiver, direction);
  }

  await applySenderParams(sender, {
    sendEncodings: options.sendEncodings,
    degradationPreference: options.degradationPreference,
  });

  if (options.onAddedTransceiver !== undefined && transceiver !== undefined) {
    await options.onAddedTransceiver(transceiver, videoTrack);
  }
};

export const hasRecvOnlyTransceiver = (connection: RTCPeerConnection): boolean => {
  return connection.getTransceivers().some((itemTransceiver) => {
    return itemTransceiver.currentDirection === 'recvonly';
  });
};
