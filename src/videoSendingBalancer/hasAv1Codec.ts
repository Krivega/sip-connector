import hasIncludesString from './hasIncludesString';

const CODEC_AV1 = 'av1';

const hasAv1Codec = (codec?: string): boolean => {
  return hasIncludesString(codec, CODEC_AV1);
};

export default hasAv1Codec;
