import type SipConnector from '../SipConnector';
import log from '../logger';

const ONE_MEGABIT_IN_BITS = 1e6;

const resolveStartPresentation = ({
  maxBitrate = ONE_MEGABIT_IN_BITS,
  sipConnector,
}: {
  maxBitrate?: number;
  sipConnector: SipConnector;
}) => {
  const startPresentation = ({
    mediaStream,
    isP2P = false,
  }: {
    mediaStream: MediaStream;
    isP2P: boolean;
  }): Promise<MediaStream | void> => {
    log('startPresentation');

    return sipConnector.startPresentation(mediaStream, {
      isP2P,
      maxBitrate,
    });
  };

  return startPresentation;
};

export default resolveStartPresentation;
