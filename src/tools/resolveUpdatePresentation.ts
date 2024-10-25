import type SipConnector from '../SipConnector';
import log from '../logger';
import type { TContentHint, TRtpSendParameters } from '../types';
import resolveHandleAddedSender from './resolveHandleAddedSender';

const resolveUpdatePresentation = (sipConnector: SipConnector) => {
  const updatePresentation = async ({
    mediaStream,
    isP2P,
    maxBitrate,
    rtpSendParameters,
    contentHint,
  }: {
    mediaStream: MediaStream;
    isP2P: boolean;
    maxBitrate?: number;
    rtpSendParameters?: TRtpSendParameters;
    contentHint?: TContentHint;
  }): Promise<MediaStream | void> => {
    log('updatePresentation');

    return sipConnector.updatePresentation(mediaStream, {
      isP2P,
      maxBitrate,
      contentHint,
      onAddedSender: resolveHandleAddedSender(rtpSendParameters),
    });
  };

  return updatePresentation;
};

export default resolveUpdatePresentation;
