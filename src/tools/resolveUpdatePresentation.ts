import type SipConnector from '../SipConnector';
import log from '../logger';
import type { TContentHint, TSimulcastEncodings } from '../types';
import generateSimulcastEncodings from './generateSimulcastEncodings';

const resolveUpdatePresentation = (sipConnector: SipConnector) => {
  const updatePresentation = async ({
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
  }): Promise<MediaStream | void> => {
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
    });
  };

  return updatePresentation;
};

export default resolveUpdatePresentation;
