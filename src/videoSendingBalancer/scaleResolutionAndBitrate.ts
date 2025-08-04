/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { TSize } from '../types';
import getMaxBitrateByWidthAndCodec from './getMaxBitrateByWidthAndCodec';

const SCALE_MIN = 1;

const scaleResolutionAndBitrate = ({
  videoTrack,
  targetSize,
  codec,
}: {
  videoTrack: MediaStreamVideoTrack;
  targetSize: TSize;
  codec?: string;
}) => {
  const settings = videoTrack.getSettings();
  const widthCurrent = settings.width!;
  const heightCurrent = settings.height!;

  const scaleByWidth = widthCurrent / targetSize.width;
  const scaleByHeight = heightCurrent / targetSize.height;

  const scaleResolutionDownBy = Math.max(scaleByWidth, scaleByHeight, SCALE_MIN);
  const maxBitrate = getMaxBitrateByWidthAndCodec(targetSize.width, codec);

  return { scaleResolutionDownBy, maxBitrate };
};

export default scaleResolutionAndBitrate;
