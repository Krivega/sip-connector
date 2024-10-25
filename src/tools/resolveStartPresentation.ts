import log from '../logger';
import type SipConnector from '../SipConnector';
import type { TContentHint } from '../types';

const resolveStartPresentation = (sipConnector: SipConnector) => {
  const startPresentation = async (
    {
      mediaStream,
      isP2P,
      maxBitrate,
      contentHint,
      sendEncodings,
    }: {
      mediaStream: MediaStream;
      isP2P: boolean;
      maxBitrate?: number;
      contentHint?: TContentHint;
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
        sendEncodings,
      },
      options,
    );
  };

  return startPresentation;
};

export default resolveStartPresentation;
