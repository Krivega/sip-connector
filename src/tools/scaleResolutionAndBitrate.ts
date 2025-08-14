import { calcMaxBitrateByWidthAndCodec, calcScaleResolutionDownBy } from '@/VideoSendingBalancer';

import type { TSize } from '@/types';

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
