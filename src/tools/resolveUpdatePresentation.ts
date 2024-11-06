import type SipConnector from '../SipConnector';
import log from '../logger';
import type { TContentHint, TSimulcastEncodings } from '../types';
import generateSimulcastEncodings from './generateSimulcastEncodings';
import resolveUpdateSenderInTransceiver from './resolveUpdateSenderInTransceiver';

const resolveUpdatePresentation = (sipConnector: SipConnector) => {
  const updatePresentation = async ({
    mediaStream,
    isP2P,
    maxBitrate,
    contentHint,
    simulcastEncodings,
    degradationPreference,
    sendEncodings,
  }: {
    mediaStream: MediaStream;
    isP2P: boolean;
    maxBitrate?: number;
    contentHint?: TContentHint;
    simulcastEncodings?: TSimulcastEncodings;
    degradationPreference?: RTCDegradationPreference;
    sendEncodings?: RTCRtpEncodingParameters[];
  }): Promise<MediaStream | void> => {
    const updateSenderInTransceiver = resolveUpdateSenderInTransceiver({
      degradationPreference,
    });

    log('updatePresentation');

    return sipConnector.updatePresentation(mediaStream, {
      isP2P,
      maxBitrate,
      contentHint,
      sendEncodings: generateSimulcastEncodings({
        mediaStream,
        simulcastEncodings,
        sendEncodings,
      }),
      onAddedTransceiver: updateSenderInTransceiver,
    });
  };

  return updatePresentation;
};

export default resolveUpdatePresentation;
