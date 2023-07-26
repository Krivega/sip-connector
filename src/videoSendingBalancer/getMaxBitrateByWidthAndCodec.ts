import getMaxBitrateByWidth from './getMaxBitrateByWidth';
import scaleBitrateByCodec from './scaleBitrateByCodec';
import { MINIMUM_BITRATE, MAXIMUM_BITRATE } from './getMaxBitrateByWidth';

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
