import log from '../logger';
import type SipConnector from '../SipConnector';
import type { TContentHint, TSimulcastEncodings } from '../types';
import generateSimulcastEncodings from './generateSimulcastEncodings';
import resolveUpdateSenderInTransceiver from './resolveUpdateSenderInTransceiver';

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
    }: {
      mediaStream: MediaStream;
      isP2P: boolean;
      maxBitrate?: number;
      contentHint?: TContentHint;
      simulcastEncodings?: TSimulcastEncodings;
      degradationPreference?: RTCDegradationPreference;
      sendEncodings?: RTCRtpEncodingParameters[];
    },
    options?: { callLimit: number },
  ): Promise<MediaStream | void> => {
    const updateSenderInTransceiver = resolveUpdateSenderInTransceiver({
      degradationPreference,
    });

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
        onAddedTransceiver: updateSenderInTransceiver,
      },
      options,
    );
  };

  return startPresentation;
};

export default resolveStartPresentation;
