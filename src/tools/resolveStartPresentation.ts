import log from '../logger';
import type SipConnector from '../SipConnector';
import type { TContentHint, TRtpSendParameters } from '../types';
import resolveHandleAddedSender from './resolveHandleAddedSender';

const resolveStartPresentation = (sipConnector: SipConnector) => {
  const startPresentation = async (
    {
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
        onAddedSender: resolveHandleAddedSender(rtpSendParameters),
      },
      options,
    );
  };

  return startPresentation;
};

export default resolveStartPresentation;
