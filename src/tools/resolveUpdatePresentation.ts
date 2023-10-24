import type SipConnector from '../SipConnector';
import log from '../logger';

const ONE_MEGABIT_IN_BITS = 1e6;

const resolveUpdatePresentation = ({
  sipConnector,
  maxBitrate = ONE_MEGABIT_IN_BITS,
}: {
  maxBitrate?: number;
  sipConnector: SipConnector;
}) => {
  const updatePresentation = async ({
    mediaStream,
    isP2P = false,
  }: {
    mediaStream: MediaStream;
    isP2P: boolean;
  }): Promise<MediaStream | void> => {
    log('updatePresentation');

    return sipConnector.updatePresentation(mediaStream, {
      isP2P,
      maxBitrate,
    });
  };

  return updatePresentation;
};

export default resolveUpdatePresentation;
