import hasAv1Codec from './hasAv1Codec';

const FACTOR_CODEC_AV1 = 0.6;

const scaleBitrateByCodec = (bitrate: number, codec?: string): number => {
  return hasAv1Codec(codec) ? bitrate * FACTOR_CODEC_AV1 : bitrate;
};

export default scaleBitrateByCodec;
