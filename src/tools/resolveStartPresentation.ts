import log from '../logger';
import type SipConnector from '../SipConnector';
import type { TContentHint, TDegradationPreference } from '../types';

const resolveStartPresentation = (sipConnector: SipConnector) => {
  const startPresentation = async (
    {
      mediaStream,
      isP2P,
      maxBitrate,
      degradationPreference,
      contentHint,
    }: {
      mediaStream: MediaStream;
      isP2P: boolean;
      maxBitrate?: number;
      degradationPreference?: TDegradationPreference;
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
        degradationPreference,
        contentHint,
      },
      options,
    );
  };

  return startPresentation;
};

export default resolveStartPresentation;
