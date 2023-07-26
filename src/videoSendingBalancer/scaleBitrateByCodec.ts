import hasAv1Codec from './hasAv1Codec';

const FACTOR_CODEC_AV1 = 0.6;

const scaleBitrateByCodec = (bitrate: number, codec?: string): number => {
  if (hasAv1Codec(codec)) {
    return bitrate * FACTOR_CODEC_AV1;
  }

  return bitrate;
};

export default scaleBitrateByCodec;
