import getMaxBitrateByWidth, { MINIMUM_BITRATE } from './getMaxBitrateByWidth';
import scaleBitrateByCodec from './scaleBitrateByCodec';

export const getMinimumBitrate = (codec?: string) => {
  return scaleBitrateByCodec(MINIMUM_BITRATE, codec);
};

const getMaxBitrateByWidthAndCodec = (maxWidth: number, codec?: string): number => {
  const maxBitrate = getMaxBitrateByWidth(maxWidth);

  return scaleBitrateByCodec(maxBitrate, codec);
};

export default getMaxBitrateByWidthAndCodec;
