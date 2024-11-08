import type SipConnector from '../SipConnector';
import log from '../logger';
import type { TContentHint, TSimulcastEncodings } from '../types';
import generateSimulcastEncodings from './generateSimulcastEncodings';
import resolveUpdateTransceiver from './resolveUpdateTransceiver';

const resolveUpdatePresentation = (sipConnector: SipConnector) => {
  const updatePresentation = async ({
    mediaStream,
    isP2P,
    maxBitrate,
    contentHint,
    simulcastEncodings,
    degradationPreference,
    sendEncodings,
    preferredMimeTypesVideoCodecs,
  }: {
    mediaStream: MediaStream;
    isP2P: boolean;
    maxBitrate?: number;
    contentHint?: TContentHint;
    simulcastEncodings?: TSimulcastEncodings;
    degradationPreference?: RTCDegradationPreference;
    sendEncodings?: RTCRtpEncodingParameters[];
    preferredMimeTypesVideoCodecs?: string[];
  }): Promise<MediaStream | void> => {
    const updateTransceiver = resolveUpdateTransceiver(
      {
        degradationPreference,
      },
      preferredMimeTypesVideoCodecs,
    );

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
      onAddedTransceiver: updateTransceiver,
    });
  };

  return updatePresentation;
};

export default resolveUpdatePresentation;
