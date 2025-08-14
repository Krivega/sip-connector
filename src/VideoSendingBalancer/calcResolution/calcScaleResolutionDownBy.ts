import type { TSize } from '@/types';

const SCALE_MIN = 1;

const calcScaleResolutionDownBy = ({
  videoTrack,
  targetSize,
}: {
  videoTrack: MediaStreamVideoTrack;
  targetSize: TSize;
}) => {
  const settings = videoTrack.getSettings();
  const widthCurrent = settings.width;
  const heightCurrent = settings.height;

  const scaleByWidth = widthCurrent === undefined ? SCALE_MIN : widthCurrent / targetSize.width;
  const scaleByHeight = heightCurrent === undefined ? SCALE_MIN : heightCurrent / targetSize.height;

  const scaleResolutionDownBy = Math.max(scaleByWidth, scaleByHeight, SCALE_MIN);

  return scaleResolutionDownBy;
};

export default calcScaleResolutionDownBy;
