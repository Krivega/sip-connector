import log from '../logger';
import type SipConnector from '../SipConnector';
import type { TContentHint, TSimulcastEncodings } from '../types';
import generateSimulcastEncodings from './generateSimulcastEncodings';
import resolveUpdateTransceiver from './resolveUpdateTransceiver';

const resolveStartPresentation = (sipConnector: SipConnector) => {
  const startPresentation = async (
    {
      mediaStream,
      isP2P,
      maxBitrate,
      contentHint,
      simulcastEncodings,
      degradationPreference,
      sendEncodings,
      preferredMimeTypesVideoCodecs,
      excludeMimeTypesVideoCodecs,
    }: {
      mediaStream: MediaStream;
      isP2P: boolean;
      maxBitrate?: number;
      contentHint?: TContentHint;
      simulcastEncodings?: TSimulcastEncodings;
      degradationPreference?: RTCDegradationPreference;
      sendEncodings?: RTCRtpEncodingParameters[];
      preferredMimeTypesVideoCodecs?: string[];
      excludeMimeTypesVideoCodecs?: string[];
    },
    options?: { callLimit: number },
  ): Promise<MediaStream | void> => {
    const updateTransceiver = resolveUpdateTransceiver(
      {
        degradationPreference,
      },
      {
        preferredMimeTypesVideoCodecs,
        excludeMimeTypesVideoCodecs,
      },
    );

    log('startPresentation');

    return sipConnector.startPresentation(
      mediaStream,
      {
        isP2P,
        maxBitrate,
        contentHint,
        sendEncodings: generateSimulcastEncodings({
          mediaStream,
          simulcastEncodings,
          sendEncodings,
        }),
        onAddedTransceiver: updateTransceiver,
      },
      options,
    );
  };

  return startPresentation;
};

export default resolveStartPresentation;
