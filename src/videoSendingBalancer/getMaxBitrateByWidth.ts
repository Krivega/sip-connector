const ONE_MEGABIT_IN_BITS = 1e6;

const megabitsToBits = (mb: number): number => {
  return mb * ONE_MEGABIT_IN_BITS;
};

export const MINIMUM_BITRATE = megabitsToBits(64);
export const MAXIMUM_BITRATE = megabitsToBits(6144);

const getMaxBitrateByWidth = (maxWidth: number): number => {
  if (maxWidth <= 64) {
    return MINIMUM_BITRATE;
  }

  if (maxWidth <= 128) {
    return megabitsToBits(128);
  }

  if (maxWidth <= 256) {
    return megabitsToBits(256);
  }

  if (maxWidth <= 384) {
    return megabitsToBits(320);
  }

  if (maxWidth <= 426) {
    return megabitsToBits(512);
  }

  if (maxWidth <= 640) {
    return megabitsToBits(1024);
  }

  if (maxWidth <= 848) {
    return megabitsToBits(1536);
  }

  if (maxWidth <= 1280) {
    return megabitsToBits(2048);
  }

  if (maxWidth <= 1920) {
    return megabitsToBits(4096);
  }

  return MAXIMUM_BITRATE;
};

export default getMaxBitrateByWidth;
