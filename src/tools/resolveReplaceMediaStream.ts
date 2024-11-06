import type SipConnector from '../SipConnector';
import log from '../logger';
import type { TContentHint, TSimulcastEncodings } from '../types';
import generateSimulcastEncodings from './generateSimulcastEncodings';
import resolveUpdateSenderInTransceiver from './resolveUpdateSenderInTransceiver';

const resolveReplaceMediaStream = (sipConnector: SipConnector) => {
  const replaceMediaStream = async (
    mediaStream: MediaStream,
    {
      deleteExisting,
      addMissing,
      forceRenegotiation,
      contentHint,
      simulcastEncodings,
      degradationPreference,
      sendEncodings,
    }: {
      deleteExisting?: boolean;
      addMissing?: boolean;
      forceRenegotiation?: boolean;
      contentHint?: TContentHint;
      simulcastEncodings?: TSimulcastEncodings;
      degradationPreference?: RTCDegradationPreference;
      sendEncodings?: RTCRtpEncodingParameters[];
    } = {},
  ): Promise<void> => {
    const updateSenderInTransceiver = resolveUpdateSenderInTransceiver({
      degradationPreference,
    });

    log('replaceMediaStream');

    return sipConnector.replaceMediaStream(mediaStream, {
      deleteExisting,
      addMissing,
      forceRenegotiation,
      contentHint,
      sendEncodings: generateSimulcastEncodings({
        mediaStream,
        simulcastEncodings,
        sendEncodings,
      }),
      onAddedTransceiver: updateSenderInTransceiver,
    });
  };

  return replaceMediaStream;
};

export default resolveReplaceMediaStream;
