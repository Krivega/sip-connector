import type { TSize } from '@/types';
import { calcMaxBitrateByWidthAndCodec, calcScaleResolutionDownBy } from '@/videoSendingBalancer';

const scaleResolutionAndBitrate = ({
  videoTrack,
  targetSize,
  codec,
}: {
  videoTrack: MediaStreamVideoTrack;
  targetSize: TSize;
  codec?: string;
}) => {
  const scaleResolutionDownBy = calcScaleResolutionDownBy({
    videoTrack,
    targetSize,
  });
  const maxBitrate = calcMaxBitrateByWidthAndCodec(targetSize.width, codec);

  return { scaleResolutionDownBy, maxBitrate };
};

export default scaleResolutionAndBitrate;
