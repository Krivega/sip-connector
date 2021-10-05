export const MINIMUM_BITRATE = 64;
export const MAXIMUM_BITRATE = 6144;

const getMaxBitrateByWidth = (maxWidth: number): number => {
  if (maxWidth <= 64) {
    return MINIMUM_BITRATE;
  }

  if (maxWidth <= 128) {
    return 128;
  }

  if (maxWidth <= 256) {
    return 256;
  }

  if (maxWidth <= 384) {
    return 320;
  }

  if (maxWidth <= 426) {
    return 512;
  }

  if (maxWidth <= 640) {
    return 1024;
  }

  if (maxWidth <= 848) {
    return 1536;
  }

  if (maxWidth <= 1280) {
    return 2048;
  }

  if (maxWidth <= 1920) {
    return 4096;
  }

  return MAXIMUM_BITRATE;
};

export default getMaxBitrateByWidth;
