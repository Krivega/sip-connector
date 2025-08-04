const ONE_MEGABIT_IN_BITS = 1e6;

const megabitsToBits = (mb: number): number => {
  return mb * ONE_MEGABIT_IN_BITS;
};

export const MINIMUM_BITRATE = megabitsToBits(0.06);
export const MAXIMUM_BITRATE = megabitsToBits(4);

const calcMaxBitrateByWidth = (maxWidth: number): number => {
  if (maxWidth <= 64) {
    return MINIMUM_BITRATE;
  }

  if (maxWidth <= 128) {
    return megabitsToBits(0.12);
  }

  if (maxWidth <= 256) {
    return megabitsToBits(0.25);
  }

  if (maxWidth <= 384) {
    return megabitsToBits(0.32);
  }

  if (maxWidth <= 426) {
    return megabitsToBits(0.38);
  }

  if (maxWidth <= 640) {
    return megabitsToBits(0.5);
  }

  if (maxWidth <= 848) {
    return megabitsToBits(0.7);
  }

  if (maxWidth <= 1280) {
    return megabitsToBits(1);
  }

  if (maxWidth <= 1920) {
    return megabitsToBits(2);
  }

  return MAXIMUM_BITRATE;
};

export default calcMaxBitrateByWidth;
