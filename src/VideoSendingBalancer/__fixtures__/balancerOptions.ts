import type { TResolutionSize } from '@/types';
import type { IBalancerOptions } from '../types';

export const NO_MAX_RESOLUTION_BALANCER_OPTIONS: IBalancerOptions = {
  getMaxResolution: () => {
    return undefined;
  },
};

export const createBalancerOptions = (
  options: Partial<Omit<IBalancerOptions, 'getMaxResolution'>> & {
    maxResolution?: TResolutionSize;
  } = {},
): IBalancerOptions => {
  const { maxResolution, ...rest } = options;

  return {
    getMaxResolution: () => {
      return maxResolution;
    },
    ...rest,
  };
};
