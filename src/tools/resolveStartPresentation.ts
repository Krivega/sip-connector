import log from '../logger';
import type SipConnector from '../SipConnector';
import type { TContentHint, TSimulcastEncodings } from '../types';
import generateSimulcastEncodings from './generateSimulcastEncodings';

const resolveStartPresentation = (sipConnector: SipConnector) => {
  const startPresentation = async (
    {
      mediaStream,
      isP2P,
      maxBitrate,
      contentHint,
      simulcastEncodings,
      sendEncodings,
    }: {
      mediaStream: MediaStream;
      isP2P: boolean;
      maxBitrate?: number;
      contentHint?: TContentHint;
      simulcastEncodings?: TSimulcastEncodings;
      sendEncodings?: RTCRtpEncodingParameters[];
    },
    options?: { callLimit: number },
  ): Promise<MediaStream | void> => {
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
      },
      options,
    );
  };

  return startPresentation;
};

export default resolveStartPresentation;
