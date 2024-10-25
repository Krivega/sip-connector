import type SipConnector from '../SipConnector';
import log from '../logger';
import type { TContentHint } from '../types';

const resolveUpdatePresentation = (sipConnector: SipConnector) => {
  const updatePresentation = async ({
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
  }): Promise<MediaStream | void> => {
    log('updatePresentation');

    return sipConnector.updatePresentation(mediaStream, {
      isP2P,
      maxBitrate,
      contentHint,
      sendEncodings,
    });
  };

  return updatePresentation;
};

export default resolveUpdatePresentation;
