import getMaxBitrateByWidth, { MAXIMUM_BITRATE, MINIMUM_BITRATE } from './getMaxBitrateByWidth';
import scaleBitrateByCodec from './scaleBitrateByCodec';

export const getMinimumBitrate = (codec?: string) => {
  return scaleBitrateByCodec(MINIMUM_BITRATE, codec);
};

export const getMaximumBitrate = (codec?: string) => {
  return scaleBitrateByCodec(MAXIMUM_BITRATE, codec);
};

const getMaxBitrateByWidthAndCodec = (maxWidth: number, codec?: string): number => {
  const maxBitrate = getMaxBitrateByWidth(maxWidth);

  return scaleBitrateByCodec(maxBitrate, codec);
};

export default getMaxBitrateByWidthAndCodec;
