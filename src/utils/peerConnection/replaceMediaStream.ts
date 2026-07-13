import { sequentPromises } from 'sequent-promises';

import { addTrackInTransceiver } from './addTransceiverStrategy';
import { applySenderParams } from './applySenderParams';
import getSenderByKindTrack from './getSenderByKindTrack';

import type { TOnAddedTransceiver } from './types';

export type TReplaceMediaStreamInConnectionOptions = {
  directionVideo?: RTCRtpTransceiverDirection;
  directionAudio?: RTCRtpTransceiverDirection;
  deleteExisting?: boolean;
  addMissing?: boolean;
  forceRenegotiation?: boolean;
  sendEncodings?: RTCRtpEncodingParameters[];
  degradationPreference?: RTCDegradationPreference;
  onAddedTransceiver?: TOnAddedTransceiver;
};

const removeMediaStreamFromConnection = (
  connection: RTCPeerConnection,
  stream: MediaStream | undefined,
): boolean => {
  if (stream === undefined) {
    return false;
  }

  const sendersByStream = connection.getSenders().filter((sender) => {
    return sender.track !== null && stream.getTracks().includes(sender.track);
  });
  const isChangedConnection = sendersByStream.length > 0;

  sendersByStream.forEach((sender) => {
    connection.removeTrack(sender);
  });

  return isChangedConnection;
};

export type TReplaceMediaStreamInConnectionParams = {
  connection: RTCPeerConnection;
  stream: MediaStream;
  localMediaStream?: MediaStream;
  renegotiate: () => Promise<boolean>;
  options?: TReplaceMediaStreamInConnectionOptions;
};

export const replaceMediaStreamInConnection = async ({
  connection,
  stream,
  localMediaStream,
  renegotiate,
  options = {},
}: TReplaceMediaStreamInConnectionParams): Promise<MediaStream> => {
  const {
    directionVideo = undefined,
    directionAudio = undefined,
    deleteExisting = true,
    addMissing = true,
    forceRenegotiation = false,
    sendEncodings = undefined,
    degradationPreference = undefined,
    onAddedTransceiver = undefined,
  } = options;

  let isChangedCountSenders = false;

  const sequentReplaceTracks = stream.getTracks().map((track) => {
    return async () => {
      const sender = getSenderByKindTrack(connection, track);

      if (sender !== undefined && sender.track !== track) {
        return sender.replaceTrack(track).then(async () => {
          return applySenderParams(sender, {
            sendEncodings,
            degradationPreference,
          });
        });
      }

      if (sender === undefined && addMissing) {
        isChangedCountSenders = true;

        const streams = [stream];
        const direction = track.kind === 'video' ? directionVideo : directionAudio;

        return addTrackInTransceiver(
          connection,
          track,
          {
            direction,
            sendEncodings,
            degradationPreference,
            onAddedTransceiver,
          },
          streams,
        );
      }

      return undefined;
    };
  });

  await sequentPromises(sequentReplaceTracks);

  if (deleteExisting) {
    isChangedCountSenders =
      removeMediaStreamFromConnection(connection, localMediaStream) || isChangedCountSenders;
  }

  if (forceRenegotiation || isChangedCountSenders) {
    await renegotiate();
  }

  return stream;
};
