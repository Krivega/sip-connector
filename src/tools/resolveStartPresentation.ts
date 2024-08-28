import type SipConnector from '../SipConnector';
import type { TDegradationPreference } from '../SipConnector';
import log from '../logger';

const resolveStartPresentation = ({
  sipConnector,
  maxBitrate,
  degradationPreference,
}: {
  sipConnector: SipConnector;
  maxBitrate?: number;
  degradationPreference?: TDegradationPreference;
}) => {
  const startPresentation = async (
    {
      mediaStream,
      isP2P,
    }: {
      mediaStream: MediaStream;
      isP2P: boolean;
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
      },
      options,
    );
  };

  return startPresentation;
};

export default resolveStartPresentation;
