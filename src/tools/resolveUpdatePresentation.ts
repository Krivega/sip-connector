import type SipConnector from '../SipConnector';
import log from '../logger';
import type { TContentHint, TDegradationPreference } from '../types';

const resolveUpdatePresentation = (sipConnector: SipConnector) => {
  const updatePresentation = async ({
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
  }): Promise<MediaStream | void> => {
    log('updatePresentation');

    return sipConnector.updatePresentation(mediaStream, {
      isP2P,
      maxBitrate,
      degradationPreference,
      contentHint,
    });
  };

  return updatePresentation;
};

export default resolveUpdatePresentation;
