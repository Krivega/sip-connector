import calcMaxBitrateByWidth, { MAXIMUM_BITRATE, MINIMUM_BITRATE } from './calcMaxBitrateByWidth';
import scaleBitrateByCodec from './scaleBitrateByCodec';

export const getMinimumBitrate = (codec?: string) => {
  return scaleBitrateByCodec(MINIMUM_BITRATE, codec);
};

export const getMaximumBitrate = (codec?: string) => {
  return scaleBitrateByCodec(MAXIMUM_BITRATE, codec);
};

const calcMaxBitrateByWidthAndCodec = (maxWidth: number, codec?: string): number => {
  const maxBitrate = calcMaxBitrateByWidth(maxWidth);

  return scaleBitrateByCodec(maxBitrate, codec);
};

export default calcMaxBitrateByWidthAndCodec;
